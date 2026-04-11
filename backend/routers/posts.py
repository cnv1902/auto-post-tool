"""
GET    /api/posts        — danh sách bài viết CỦA USER HIỆN TẠI
DELETE /api/posts/bulk   — xóa hàng loạt (chỉ posts của user)
DELETE /api/posts/{id}   — xóa 1 bài viết (chỉ nếu thuộc user)
"""
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from database import get_db, User, Post, Page
from auth import get_current_user

router = APIRouter()


@router.get("/api/posts")
def list_posts(
    page_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trả về posts của user hiện tại, có thể filter theo page_id."""
    query = db.query(Post).filter(Post.user_id == current_user.id)
    if page_id:
        query = query.filter(Post.page_id == page_id)

    posts = query.order_by(Post.created_at.desc()).all()
    return {
        "posts": [
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
            for p in posts
        ],
        "total": len(posts),
    }


class BulkDeletePayload(BaseModel):
    post_ids: List[str]


@router.delete("/api/posts/bulk")
def bulk_delete_posts(
    payload: BulkDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa hàng loạt — xóa FB API và sau đó xóa khỏi DB."""
    if not payload.post_ids:
        raise HTTPException(status_code=400, detail="Danh sách post_ids không được rỗng.")

    posts_to_delete = db.query(Post).filter(Post.post_id.in_(payload.post_ids), Post.user_id == current_user.id).all()
    
    # Gửi FB Delete
    for post in posts_to_delete:
        page = db.query(Page).filter(Page.page_id == post.page_id, Page.user_id == current_user.id).first()
        if page and page.page_access_token:
            try:
                requests.delete(f"https://graph.facebook.com/v19.0/{post.post_id}", params={"access_token": page.page_access_token}, timeout=10)
            except Exception as e:
                print(f"[bulk_delete] Failed to delete on FB: {e}")

    deleted = (
        db.query(Post)
        .filter(Post.post_id.in_(payload.post_ids), Post.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted, "requested": len(payload.post_ids)}


@router.delete("/api/posts/{post_id}")
def delete_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa 1 bài viết — xóa trên FB trước rồi xóa DB."""
    post = (
        db.query(Post)
        .filter(Post.post_id == post_id, Post.user_id == current_user.id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bài viết: {post_id}")

    page = db.query(Page).filter(Page.page_id == post.page_id, Page.user_id == current_user.id).first()
    if page and page.page_access_token:
        try:
            res = requests.delete(f"https://graph.facebook.com/v19.0/{post.post_id}", params={"access_token": page.page_access_token}, timeout=10)
            print(f"[delete_post] FB Response: {res.text}")
        except Exception as e:
            print(f"[delete_post] Exception FB: {e}")

    db.delete(post)
    db.commit()
    return {"deleted": True, "post_id": post_id}
