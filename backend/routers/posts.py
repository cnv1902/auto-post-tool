"""
GET    /api/posts        — danh sách bài viết CỦA USER HIỆN TẠI
DELETE /api/posts/bulk   — xóa hàng loạt (chỉ posts của user)
DELETE /api/posts/{id}   — xóa 1 bài viết (chỉ nếu thuộc user)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from database import get_db, User, Post
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
    """Xóa hàng loạt — chỉ xóa posts thuộc về user hiện tại."""
    if not payload.post_ids:
        raise HTTPException(status_code=400, detail="Danh sách post_ids không được rỗng.")

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
    """Xóa 1 bài viết — chỉ nếu thuộc về user hiện tại."""
    post = (
        db.query(Post)
        .filter(Post.post_id == post_id, Post.user_id == current_user.id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bài viết: {post_id}")

    db.delete(post)
    db.commit()
    return {"deleted": True, "post_id": post_id}
