"""
POST /api/setup — Manual setup: user nhập token + ad_account_id thủ công.
Giờ cần auth — lưu vào User row thay vì Config.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, User, Page
from auth import get_current_user
from services.facebook import fetch_user_info, fetch_pages, fetch_ad_accounts

router = APIRouter()


class SetupPayload(BaseModel):
    user_token:    str
    ad_account_id: str


@router.post("/api/setup")
def setup(
    payload: SetupPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Kiểm tra token hợp lệ
    user_info = fetch_user_info(payload.user_token)
    if "error" in user_info:
        raise HTTPException(
            status_code=400,
            detail=user_info["error"].get("message", "Token không hợp lệ"),
        )

    # 2. Fetch pages
    pages = fetch_pages(payload.user_token)

    # 3. Cập nhật User row
    current_user.access_token = payload.user_token
    current_user.ad_account_id = payload.ad_account_id
    current_user.can_use_ads = bool(payload.ad_account_id)

    # 4. Cập nhật pages (xóa cũ của user này, thay bằng mới)
    db.query(Page).filter(Page.user_id == current_user.id).delete()
    for p in pages:
        db.add(Page(
            page_id=p["page_id"],
            page_name=p["page_name"],
            page_access_token=p["page_token"],
            user_id=current_user.id,
        ))

    db.commit()

    return {
        "user":  {"id": user_info.get("id"), "name": user_info.get("name")},
        "pages": pages,
        "total": len(pages),
    }
