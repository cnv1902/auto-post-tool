"""
GET    /api/posts        — danh sách bài viết trực tiếp từ FB Graph API + Scheduled nội bộ
DELETE /api/posts/bulk   — xóa hàng loạt trêm FB & DB
DELETE /api/posts/{id}   — xóa 1 bài viết trên FB & DB
"""
import requests
import concurrent.futures
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db, User, Post, Page
from auth import get_current_user

router = APIRouter()


def fetch_fb_posts(page_id: str, page_name: str, page_token: str, limit: int = 50) -> List[dict]:
    """Helper method to fetch posts from FB graph API for a specific page."""
    url = f"https://graph.facebook.com/v19.0/{page_id}/posts"
    params = {
        "fields": "id,message,created_time,permalink_url,full_picture",
        "access_token": page_token,
        "limit": limit
    }
    
    try:
        res = requests.get(url, params=params, timeout=15)
        data = res.json()
        
        fb_posts = []
        for p in data.get("data", []):
            fb_posts.append({
                "post_id":       p.get("id"),
                "page_id":       page_id,
                "page_name":     page_name,
                "message":       p.get("message", ""),
                "permalink":     p.get("permalink_url", f"https://www.facebook.com/{p.get('id')}"),
                "thumbnail_url": p.get("full_picture", ""),
                "status":        "published",
                "created_at":    p.get("created_time")
            })
        return fb_posts
    except Exception as e:
        print(f"[list_posts] FB API error for page {page_id}: {e}")
        return []


@router.get("/api/posts")
def list_posts(
    page_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trả về tất cả posts của user hiện tại. 
    Kết hợp:
      - Các bài viết Scheduled từ trong Database.
      - Các bài viết THỰC TẾ đang có trên Fanpage (gọi Graph API).
    """
    # 1. Lấy danh sách các trang cần fetch
    page_query = db.query(Page).filter(Page.user_id == current_user.id)
    if page_id:
        page_query = page_query.filter(Page.page_id == page_id)
        
    pages = page_query.all()
    if not pages:
        return {"posts": [], "total": 0}

    # 2. Fetch Facebook Posts (có thể có nhiều page nên xài threads)
    fb_all_posts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_page = {executor.submit(fetch_fb_posts, p.page_id, p.page_name, p.page_access_token): p.page_id for p in pages}
        for future in concurrent.futures.as_completed(future_to_page):
            try:
                res = future.result()
                fb_all_posts.extend(res)
            except Exception as e:
                print(f"[list_posts] Thread error fetching posts: {e}")

    # 3. Lấy local scheduled posts từ DB
    db_query = db.query(Post).filter(Post.user_id == current_user.id, Post.status == "scheduled")
    if page_id:
        db_query = db_query.filter(Post.page_id == page_id)
    scheduled_posts = db_query.all()

    local_posts = [
        {
            "post_id":       p.post_id,
            "page_id":       p.page_id,
            "page_name":     p.page_name,
            "message":       p.message,
            "permalink":     p.permalink,
            "thumbnail_url": p.thumbnail_url,
            "status":        p.status,
            "created_at":    p.created_at.isoformat() if p.created_at else None,
        }
        for p in scheduled_posts
    ]

    # Combine & Sort descending by created_at
    combined_posts = local_posts + fb_all_posts
    
    # Sort helper since FB returns strings formatted differently than our local ISO format
    def get_sort_key(p):
        if not p.get("created_at"): return ""
        return p["created_at"]

    combined_posts.sort(key=get_sort_key, reverse=True)

    return {
        "posts": combined_posts,
        "total": len(combined_posts),
    }


class PostIdentifier(BaseModel):
    post_id: str
    page_id: str

class BulkDeletePayload(BaseModel):
    items: List[PostIdentifier]


@router.delete("/api/posts/bulk")
def bulk_delete_posts(
    payload: BulkDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa hàng loạt bài viết trực tiếp từ FB API dựa vào thông tin page_id cung cấp."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="Danh sách items rỗng.")

    deleted_count = 0
    
    # Tối ưu việc query Pages
    user_pages = db.query(Page).filter(Page.user_id == current_user.id).all()
    page_dict = { p.page_id: p for p in user_pages }
    
    for item in payload.items:
        page = page_dict.get(item.page_id)
        if not page:
            continue
            
        # Nếu là scheduled post trong db (prefix sch_) -> ko gọi FB (vì chưa đăng)
        if item.post_id.startswith("sch_"):
            db.query(Post).filter(Post.post_id == item.post_id, Post.user_id == current_user.id).delete(synchronize_session=False)
            deleted_count += 1
            continue

        # Post thật trên FB -> Gọi API xóa
        if page.page_access_token:
            try:
                res = requests.delete(f"https://graph.facebook.com/v19.0/{item.post_id}", params={"access_token": page.page_access_token}, timeout=10)
                # Dù thành công hay không, ta vẫn cố xóa ở Local DB just in case nó từng đc lưu
                db.query(Post).filter(Post.post_id == item.post_id, Post.user_id == current_user.id).delete(synchronize_session=False)
                deleted_count += 1
            except Exception as e:
                print(f"[bulk_delete] Failed to delete on FB {item.post_id}: {e}")

    db.commit()
    return {"deleted": deleted_count, "requested": len(payload.items)}


@router.delete("/api/posts/{post_id}")
def delete_post(
    post_id: str,
    page_id: str = Query(..., description="Cần trang page_id để lấy FB token xóa bài"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa 1 bài viết — gọi FB Graph API dựa vào page_id"""
    page = db.query(Page).filter(Page.page_id == page_id, Page.user_id == current_user.id).first()
    
    if not page:
        raise HTTPException(status_code=403, detail="Không có quyền trên Fanpage này.")

    if post_id.startswith("sch_"):
        # Post chưa list lên FB, xoá dứt điểm DB
        db.query(Post).filter(Post.post_id == post_id, Post.user_id == current_user.id).delete(synchronize_session=False)
    else:
        # FB ID
        try:
            res = requests.delete(f"https://graph.facebook.com/v19.0/{post_id}", params={"access_token": page.page_access_token}, timeout=10)
            if res.status_code >= 400:
                print(f"[delete_post] Warning FB Response: {res.text}")
        except Exception as e:
            print(f"[delete_post] Exception FB: {e}")
            
        # Thử dọn DB rác:
        db.query(Post).filter(Post.post_id == post_id, Post.user_id == current_user.id).delete(synchronize_session=False)
        
    db.commit()
    return {"deleted": True, "post_id": post_id}
