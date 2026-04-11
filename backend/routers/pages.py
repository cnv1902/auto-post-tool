"""
GET /api/pages   — danh sách pages CỦA USER HIỆN TẠI
GET /api/config  — trả về config hiện tại cho user
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db, User, Page
from auth import get_current_user

router = APIRouter()


@router.get("/api/pages")
def list_pages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chỉ trả pages thuộc về user hiện tại."""
    pages = (
        db.query(Page)
        .filter(Page.user_id == current_user.id)
        .order_by(Page.page_name)
        .all()
    )
    return {
        "pages": [
            {
                "page_id":   p.page_id,
                "page_name": p.page_name,
                # KHÔNG trả page_access_token ra ngoài
            }
            for p in pages
        ]
    }


@router.get("/api/config")
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trả về config cho user hiện tại."""
    pages_count = db.query(Page).filter(Page.user_id == current_user.id).count()
    return {
        "has_token":       bool(current_user.access_token),
        "ad_account_id":   current_user.ad_account_id or "",
        "can_use_ads":     current_user.can_use_ads,
        "pages_count":     pages_count,
    }
