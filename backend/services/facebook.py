"""
facebook.py — Tất cả logic gọi Facebook Graph API.
Refactored từ setupinfo.py và main.py để dùng lại trong FastAPI.
"""
import os
import time
import json
import asyncio
import requests
from typing import AsyncGenerator, Optional

BASE_URL       = "https://graph.facebook.com/v19.0"
BASE_VIDEO_URL = "https://graph-video.facebook.com/v19.0"


# ─────────────────────────────────────────────
#  SETUP: Lấy thông tin user + pages
# ─────────────────────────────────────────────

def fetch_user_info(user_token: str) -> dict:
    """Trả về {id, name} của user, hoặc {error: ...}"""
    res = requests.get(
        f"{BASE_URL}/me",
        params={"fields": "id,name", "access_token": user_token},
        timeout=15,
    ).json()
    return res


def fetch_pages(user_token: str) -> list[dict]:
    """
    Trả về danh sách pages mà user sở hữu.
    Mỗi phần tử: {page_id, page_name, page_token}
    """
    res = requests.get(
        f"{BASE_URL}/me/accounts",
        params={"access_token": user_token},
        timeout=15,
    ).json()

    if "error" in res:
        print(f"[fetch_pages] FB API error: {res['error']}")
        return []

    pages = []
    for p in res.get("data", []):
        pages.append({
            "page_id":    p["id"],
            "page_name":  p["name"],
            "page_token": p["access_token"],
        })
    print(f"[fetch_pages] Got {len(pages)} pages")
    return pages


def fetch_ad_accounts(user_token: str) -> list[dict]:
    """Trả về danh sách Ad Accounts của user."""
    res = requests.get(
        f"{BASE_URL}/me/adaccounts",
        params={"fields": "id,name,account_status", "access_token": user_token},
        timeout=15,
    ).json()
    return res.get("data", [])


# ─────────────────────────────────────────────
#  PUBLISH: Upload & đăng bài
# ─────────────────────────────────────────────

def upload_hidden_video(page_token: str, file_path: str) -> Optional[str]:
    """Upload video ẩn lên page. Trả về video_id hoặc None."""
    try:
        with open(file_path, "rb") as f:
            res = requests.post(
                f"{BASE_VIDEO_URL}/me/videos",
                data={"published": "false", "access_token": page_token},
                files={"source": (os.path.basename(file_path), f, "video/mp4")},
                timeout=300,
            ).json()
        if "id" in res:
            return res["id"]
        print(f"[upload_video] FB trả về lỗi: {json.dumps(res, ensure_ascii=False)[:300]}")
        return None
    except Exception as ex:
        print(f"[upload_video] Exception: {ex}")
        return None


def upload_hidden_photo(
    page_token: str,
    page_id: str,
    file_path: str,
) -> tuple[Optional[str], Optional[str]]:
    """Upload ảnh ẩn lên page. Trả về (photo_id, img_url) hoặc (None, None)."""
    try:
        with open(file_path, "rb") as f:
            res = requests.post(
                f"{BASE_URL}/{page_id}/photos",
                data={"published": "false", "access_token": page_token},
                files={"source": (os.path.basename(file_path), f, "image/jpeg")},
                timeout=120,
            ).json()
        if "id" in res:
            info = requests.get(
                f"{BASE_URL}/{res['id']}",
                params={"fields": "images", "access_token": page_token},
                timeout=15,
            ).json()
            img_url = info.get("images", [{}])[0].get("source")
            return res["id"], img_url
        print(f"[upload_photo] FB trả về lỗi: {json.dumps(res, ensure_ascii=False)[:300]}")
        return None, None
    except Exception as ex:
        print(f"[upload_photo] Exception: {ex}")
        return None, None


def wait_for_video_ready(page_token: str, video_id: str, timeout: int = 300) -> bool:
    """Poll cho đến khi video sẵn sàng hoặc timeout."""
    deadline = time.time() + timeout
    attempt  = 0
    while time.time() < deadline:
        attempt += 1
        res    = requests.get(
            f"{BASE_URL}/{video_id}",
            params={"fields": "status", "access_token": page_token},
            timeout=15,
        ).json()
        status = res.get("status", {}).get("video_status", "unknown")
        if status == "ready":
            return True
        if status == "error":
            return False
        time.sleep(10)
    return False


# ─────────────────────────────────────────────
#  CTA BUILDER — tạo call_to_action object đúng cho từng loại
# ─────────────────────────────────────────────

# Các CTA dùng link website bình thường
LINK_CTAS = {
    "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "DOWNLOAD", "BOOK_NOW",
    "CONTACT_US", "GET_QUOTE", "GET_OFFER", "ORDER_NOW", "APPLY_NOW",
    "WATCH_MORE", "LISTEN_NOW", "PLAY_GAME", "USE_APP", "SUBSCRIBE",
}

def _build_cta(cta_type: str, safe_link: str, page_id: str) -> Optional[dict]:
    """
    Tạo call_to_action object đúng cho từng loại CTA.
    Trả về None nếu NO_BUTTON → không thêm CTA vào attachment.
    """
    if cta_type == "NO_BUTTON":
        return None

    if cta_type == "SEND_MESSAGE":
        # Messenger link
        return {
            "type": "MESSAGE_PAGE",
            "value": {"link": f"https://m.me/{page_id}"},
        }

    if cta_type == "WHATSAPP_MESSAGE":
        # WhatsApp — dùng link wa.me (phone số page nếu có)
        return {
            "type": "WHATSAPP_MESSAGE",
            "value": {"link": safe_link},
        }

    if cta_type == "CALL_NOW":
        # Gọi điện — link có thể là tel: hoặc URL thường
        return {
            "type": "CALL_NOW",
            "value": {"link": safe_link},
        }

    # Tất cả link-based CTAs
    return {
        "type": cta_type,
        "value": {"link": safe_link},
    }


def _build_card(card_data: dict, page_id: str) -> dict:
    """
    Tạo child_attachment object cho 1 card.
    card_data keys: name, description, link, picture, cta_type, video_id (optional)
    """
    card = {
        "name": card_data["name"],
        "link": card_data["link"],
        "picture": card_data["picture"],
    }
    if card_data.get("description"):
        card["description"] = card_data["description"]
    if card_data.get("video_id"):
        card["video_id"] = card_data["video_id"]

    cta = _build_cta(card_data["cta_type"], card_data["link"], page_id)
    if cta:
        card["call_to_action"] = cta

    return card


def post_darkpost_carousel(
    user_token: str,
    page_token: str,
    page_id: str,
    ad_account_id: str,
    message: str,
    safe_link: str,
    card1_title: str,
    card2_title: str,
    card1_desc: str,
    card2_desc: str,
    card1_cta: str,
    card2_cta: str,
    video_id: str,
    thumbnail_url: str,
    img_url: str,
    card2_file_path: str,
    scheduled_time: Optional[int] = None,
) -> dict:
    """
    Tạo dark post carousel.
    Trả về {"success": True, "post_id": ..., "permalink": ...}
    hoặc  {"success": False, "error": ...}
    """
    ts = int(time.time())

    # Bước 0: Lấy image_hash từ ad account
    with open(card2_file_path, "rb") as f:
        hash_res = requests.post(
            f"{BASE_URL}/{ad_account_id}/adimages",
            data={"access_token": user_token},
            files={"source": f},
            timeout=120,
        ).json()

    if "images" not in hash_res:
        return {"success": False, "error": f"Không lấy được image_hash: {hash_res}"}

    image_hash = list(hash_res["images"].values())[0]["hash"]

    # Bước 1: Build Cards
    card1 = _build_card({
        "name":      card1_title,
        "description": card1_desc,
        "link":      safe_link,
        "picture":   thumbnail_url,
        "cta_type":  card1_cta,
        "video_id":  video_id,
    }, page_id)

    card2 = _build_card({
        "name":      card2_title,
        "description": card2_desc,
        "link":      safe_link,
        "picture":   img_url,
        "cta_type":  card2_cta,
    }, page_id)

    # Bước 2: Tạo Ad Creative
    object_story = {
        "page_id": page_id,
        "link_data": {
            "message": message,
            "link": safe_link,
            "picture": thumbnail_url,
            "child_attachments": [card1, card2],
            "multi_share_end_card": False,
        },
    }

    print(f"[carousel] object_story_spec: {json.dumps(object_story, ensure_ascii=False)[:500]}")

    creative_res = requests.post(
        f"{BASE_URL}/{ad_account_id}/adcreatives",
        data={
            "name": f"DarkPost_{ts}",
            "object_story_spec": json.dumps(object_story),
            "access_token": user_token,
        },
        timeout=30,
    ).json()

    if "id" not in creative_res:
        return {"success": False, "error": f"Tạo creative thất bại: {creative_res}"}

    creative_id = creative_res["id"]

    # Bước 2: Lấy Post ID
    post_id = None
    for attempt in range(15):
        time.sleep(3)
        story_res = requests.get(
            f"{BASE_URL}/{creative_id}",
            params={
                "fields": "object_story_id,effective_object_story_id",
                "access_token": user_token,
            },
            timeout=15,
        ).json()
        post_id = story_res.get("effective_object_story_id") or story_res.get("object_story_id")
        if post_id:
            break

    if not post_id:
        return {"success": False, "error": "Không lấy được Post ID sau 15 lần thử."}

    # Bước 3: Publish
    payload = {"access_token": page_token}
    if scheduled_time:
        payload["is_published"] = "false"
        payload["scheduled_publish_time"] = str(scheduled_time)
    else:
        payload["is_published"] = "true"

    requests.post(
        f"{BASE_URL}/{post_id}",
        data=payload,
        timeout=15,
    )

    # Bước 4: Verify
    time.sleep(3)
    check_res = requests.get(
        f"{BASE_URL}/{post_id}",
        params={
            "fields": "id,message,is_published,permalink_url",
            "access_token": page_token,
        },
        timeout=15,
    ).json()

    numeric_post_id = post_id.split("_")[-1]
    permalink = check_res.get(
        "permalink_url",
        f"https://www.facebook.com/{page_id}/posts/{numeric_post_id}",
    )

    if check_res.get("is_published"):
        return {"success": True, "post_id": post_id, "permalink": permalink}
    else:
        return {
            "success": False,
            "error": f"Vẫn chưa public: {check_res}",
            "permalink": permalink,
        }


# ─────────────────────────────────────────────
#  ASYNC GENERATOR: Stream từng bước log
# ─────────────────────────────────────────────

async def publish_stream(
    user_token: str,
    page_token: str,
    page_id: str,
    ad_account_id: str,
    message: str,
    safe_link: str,
    card1_title: str,
    card2_title: str,
    card1_desc: str,
    card2_desc: str,
    card1_cta: str,
    card2_cta: str,
    video_path: str,
    thumbnail_path: str,
    image_path: str,
    scheduled_time: Optional[int] = None,
) -> AsyncGenerator[str, None]:
    """
    Async generator yield từng dòng log dạng SSE data.
    Mỗi yield là một JSON string.
    """

    def emit(level: str, msg: str) -> str:
        print(f"[{level.upper()}] {msg}")  # In ra terminal uvicorn
        return f"data: {json.dumps({'level': level, 'msg': msg})}\n\n"

    loop = asyncio.get_event_loop()

    try:
        # 1. Upload Video
        yield emit("info", f"🔄 Đang tải lên video [{os.path.basename(video_path)}] ({os.path.getsize(video_path) / 1024 / 1024:.1f} MB)...")
        video_id = await loop.run_in_executor(
            None, upload_hidden_video, page_token, video_path
        )
        if not video_id:
            yield emit("error", "❌ Upload video thất bại. Kiểm tra terminal uvicorn để xem lỗi chi tiết.")
            yield emit("info", "💡 Nguyên nhân phổ biến: Token hết hạn, file quá lớn, hoặc page_token không có quyền upload.")
            yield "data: [DONE]\n\n"
            return
        yield emit("success", f"✅ Upload video OK — ID: {video_id}")

        # 2. Upload Thumbnail cho Video (Card 1)
        yield emit("info", f"🖼️ Đang tải lên thumbnail video [{os.path.basename(thumbnail_path)}]...")
        thumb_id, thumbnail_url = await loop.run_in_executor(
            None, upload_hidden_photo, page_token, page_id, thumbnail_path
        )
        if not thumbnail_url:
            yield emit("error", "❌ Upload thumbnail thất bại. Dừng lại.")
            yield "data: [DONE]\n\n"
            return
        yield emit("success", f"✅ Upload thumbnail OK — ID: {thumb_id}")

        # 3. Upload Ảnh (Card 2)
        yield emit("info", f"🔄 Đang tải lên ảnh Card 2 [{os.path.basename(image_path)}]...")
        photo_id, img_url = await loop.run_in_executor(
            None, upload_hidden_photo, page_token, page_id, image_path
        )
        if not img_url:
            yield emit("error", "❌ Upload ảnh Card 2 thất bại. Dừng lại.")
            yield "data: [DONE]\n\n"
            return
        yield emit("success", f"✅ Upload ảnh Card 2 OK — ID: {photo_id}")

        # 4. Chờ video sẵn sàng
        yield emit("info", f"⏳ Đang chờ Facebook xử lý video (có thể mất vài phút)...")
        ready = await loop.run_in_executor(
            None, wait_for_video_ready, page_token, video_id, 300
        )
        if not ready:
            yield emit("error", "❌ Video không sẵn sàng hoặc bị từ chối. Dừng lại.")
            yield "data: [DONE]\n\n"
            return
        yield emit("success", "✅ Video đã sẵn sàng!")

        # 5. Đăng bài
        yield emit("info", "🔄 Đang tạo Dark Post Carousel...")
        result = await loop.run_in_executor(
            None,
            post_darkpost_carousel,
            user_token,
            page_token,
            page_id,
            ad_account_id,
            message,
            safe_link,
            card1_title,
            card2_title,
            card1_desc,
            card2_desc,
            card1_cta,
            card2_cta,
            video_id,
            thumbnail_url,
            img_url,
            image_path,
            scheduled_time,
        )

        if result["success"]:
            yield emit("success", f"🎉 BÀI ĐÃ {'LÊN LỊCH' if scheduled_time else 'PUBLIC'}!")
            yield emit("link", result["permalink"])
            # Yield post_id so backend DB can store the real FB graph post_id
            yield emit("post_id", result["post_id"])
        else:
            yield emit("error", f"❌ {result.get('error', 'Lỗi không xác định')}")
            if result.get("permalink"):
                yield emit("link", result["permalink"])

    except Exception as ex:
        yield emit("error", f"💥 Exception: {str(ex)}")
    finally:
        # Xóa file tạm sau khi xong
        for path in [video_path, thumbnail_path, image_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass
        yield "data: [DONE]\n\n"

