"""
POST /api/extract-token — Nhận cookies từ Chrome Extension
Backend dùng Playwright để lấy User Token + AD_ACCOUNT_ID + Pages tự động
LƯU VÀO User row (per-user) thay vì global Config.
"""
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db, User, Page
from auth import get_current_user
from services.token_extractor import extract_token_stream

router = APIRouter()


class CookieItem(BaseModel):
    name:           str
    value:          str
    domain:         Optional[str] = ".facebook.com"
    path:           Optional[str] = "/"
    httpOnly:       Optional[bool] = False
    secure:         Optional[bool] = True
    expirationDate: Optional[float] = None


class ExtractTokenPayload(BaseModel):
    cookies: List[CookieItem]


@router.post("/api/extract-token")
async def extract_token(
    payload: ExtractTokenPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raw_cookies = [c.model_dump() for c in payload.cookies]

    async def event_generator():
        captured_token = None
        captured_ad_id = None
        captured_pages = []

        # Đọc từng chunk — chặn [DONE], xử lý DB trước khi gửi [DONE]
        async for chunk in extract_token_stream(raw_cookies):
            if chunk.strip() == "data: [DONE]":
                break

            yield chunk

            if chunk.startswith("data: "):
                try:
                    data = json.loads(chunk[6:].strip())
                    if data.get("level") == "result":
                        captured_token = data.get("token")
                        captured_ad_id = data.get("ad_account_id", "")
                        captured_pages = data.get("pages", [])
                except Exception:
                    pass

        # ── Lưu vào User row (per-user) ──
        if captured_token:
            try:
                current_user.access_token = captured_token
                if captured_ad_id:
                    current_user.ad_account_id = captured_ad_id
                    current_user.can_use_ads = True

                # Lưu pages cho user này
                db.query(Page).filter(Page.user_id == current_user.id).delete()
                saved_count = 0
                for pg in captured_pages:
                    if pg.get("page_id") and pg.get("page_token"):
                        db.add(Page(
                            page_id=pg["page_id"],
                            page_name=pg.get("page_name", "Unknown"),
                            page_access_token=pg["page_token"],
                            user_id=current_user.id,
                        ))
                        saved_count += 1

                db.commit()

                print(f"[EXTRACT] ✅ DB saved for user={current_user.name}: "
                      f"token + {saved_count} pages + ad_id={captured_ad_id}")

                yield f"data: {json.dumps({'level': 'success', 'msg': f'✅ Đã lưu {saved_count} Fanpage vào hệ thống!'})}\\n\\n"
                yield f"data: {json.dumps({'level': 'complete', 'pages': saved_count, 'has_ad_id': bool(captured_ad_id)})}\\n\\n"

            except Exception as ex:
                print(f"[EXTRACT][ERROR] DB save: {ex}")
                yield f"data: {json.dumps({'level': 'error', 'msg': f'Lỗi lưu DB: {ex}'})}\\n\\n"

        yield "data: [DONE]\\n\\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
