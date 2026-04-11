"""
POST /api/publish — nhận multipart/form-data, stream log qua SSE.
Tokens lấy từ User + Page (per-user), KHÔNG dùng global Config.
"""
import os
import uuid
import json
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Annotated

from database import get_db, User, Page, Post
from auth import get_current_user
from services.facebook import publish_stream

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def _save_upload(file: UploadFile, suffix: str) -> str:
    """Lưu file upload tạm thời, trả về đường dẫn tuyệt đối."""
    filename = f"{uuid.uuid4().hex}{suffix}"
    dest = os.path.abspath(os.path.join(UPLOAD_DIR, filename))
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return dest


@router.post("/api/publish")
async def publish(
    page_id:     Annotated[str, Form()],
    message:     Annotated[str, Form()],
    safe_link:   Annotated[str, Form()],
    card1_title: Annotated[str, Form()],
    card2_title: Annotated[str, Form()],
    card1_desc:  Annotated[str, Form()] = "",
    card2_desc:  Annotated[str, Form()] = "",
    card1_cta:   Annotated[str, Form()] = "LEARN_MORE",
    card2_cta:   Annotated[str, Form()] = "LEARN_MORE",
    scheduled_time: Annotated[str, Form()] = "",
    video_file:     UploadFile = File(...),
    thumbnail_file: UploadFile = File(...),
    image_file:     UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print(f"🚀 Publish: user={current_user.name}, page={page_id}, cta1={card1_cta}, cta2={card2_cta}")

    # ── Lấy tokens từ User (per-user) ──
    user_token = current_user.access_token
    ad_account_id = current_user.ad_account_id

    if not user_token:
        raise HTTPException(status_code=400, detail="Chưa có User Token. Hãy đăng nhập lại.")

    if not ad_account_id:
        raise HTTPException(
            status_code=400,
            detail="User does not have ads_management permission. Cần ad_account_id để dùng Marketing API.",
        )

    # ── Lấy page token từ DB (thuộc user hiện tại) ──
    page = (
        db.query(Page)
        .filter(Page.page_id == page_id, Page.user_id == current_user.id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy page ID: {page_id}")

    page_token = page.page_access_token

    # Lưu file tạm
    video_path     = await _save_upload(video_file, ".mp4")
    thumbnail_path = await _save_upload(thumbnail_file, ".jpg")
    image_path     = await _save_upload(image_file, ".jpg")

    # Biến capture post info cho DB
    captured_post = {}
    
    parsed_scheduled_time = None
    if scheduled_time.isdigit():
        parsed_scheduled_time = int(scheduled_time)

    async def event_generator():
        async for chunk in publish_stream(
            user_token     = user_token,       # USER TOKEN — cho Marketing API
            page_token     = page_token,       # PAGE TOKEN — cho upload/publish
            page_id        = page_id,
            ad_account_id  = ad_account_id,
            message        = message,
            safe_link      = safe_link,
            card1_title    = card1_title,
            card2_title    = card2_title,
            card1_desc     = card1_desc,
            card2_desc     = card2_desc,
            card1_cta      = card1_cta,
            card2_cta      = card2_cta,
            video_path     = video_path,
            thumbnail_path = thumbnail_path,
            image_path     = image_path,
            scheduled_time = parsed_scheduled_time,
        ):
            # Capture post info từ stream để lưu DB
            if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
                try:
                    data = json.loads(chunk[6:].strip())
                    if data.get("level") == "link":
                        captured_post["permalink"] = data["msg"]
                    if data.get("level") == "post_id":
                        captured_post["post_id"] = data["msg"]
                    if data.get("level") == "success" and ("BÀI ĐÃ PUBLIC" in data.get("msg", "") or "BÀI ĐÃ LÊN LỊCH" in data.get("msg", "")):
                        captured_post["success"] = True
                except Exception:
                    pass

            # Nếu done + success → lưu Post vào DB với user_id
            if chunk.strip() == "data: [DONE]" and captured_post.get("success"):
                try:
                    # Prefer the real FB post_id, fallback to old logic
                    real_post_id = captured_post.get("post_id") or captured_post.get("permalink", "").split("/")[-1] or uuid.uuid4().hex
                    post_status = "scheduled" if parsed_scheduled_time else "published"
                    post = Post(
                        post_id   = real_post_id,
                        page_id   = page_id,
                        page_name = page.page_name,
                        message   = message[:500],
                        permalink = captured_post.get("permalink", ""),
                        status    = post_status,
                        user_id   = current_user.id,  # ← per-user!
                    )
                    db.add(post)
                    db.commit()
                    print(f"[PUBLISH] ✅ Saved post to DB: {post.post_id} (user={current_user.name})")
                except Exception as ex:
                    print(f"[PUBLISH][WARN] Failed to save post to DB: {ex}")

            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
