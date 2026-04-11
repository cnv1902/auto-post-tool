import asyncio
import time
import json
import logging
from database import SessionLocal, Post, User, Page
from services.facebook import publish_stream, publish_single_stream, publish_normal_stream
import uuid

logger = logging.getLogger(__name__)

async def background_scheduler_loop():
    """Vòng lặp chạy ngầm, quét DB để tìm bài viết tới giờ hẹn và đăng."""
    await asyncio.sleep(5) # Chờ app khởi động xong
    logger.info("🕒 Backend Scheduler started.")
    
    while True:
        try:
            await process_scheduled_posts()
        except Exception as e:
            logger.error(f"Scheduler exception: {e}")
        
        await asyncio.sleep(20) # Kiểm tra mỗi 20 giây


async def process_scheduled_posts():
    db = SessionLocal()
    try:
        now = int(time.time())
        # Lấy các bài viết có trạng thái 'scheduled' và đã đến giờ
        due_posts = db.query(Post).filter(
            Post.status == "scheduled",
            Post.scheduled_time <= now
        ).all()

        for post in due_posts:
            logger.info(f"🚀 [SCHEDULER] Bắt đầu đăng bài {post.post_id} (Type: {post.post_type})")
            # Mark processing temporarily so it won't be picked up again
            post.status = "processing"
            db.commit()

            success = await execute_post(db, post)
            
            if success:
                logger.info(f"✅ [SCHEDULER] Post {post.post_id} thành công!")
            else:
                logger.error(f"❌ [SCHEDULER] Post {post.post_id} thất bại.")
                
    finally:
        db.close()


async def execute_post(db, post: Post) -> bool:
    try:
        payload = json.loads(post.payload)
        user_token = payload.get("user_token")
        page_token = payload.get("page_token")
        
        captured_data = {"success": False, "permalink": "", "post_id": ""}
        
        async def mock_event_consumer(stream):
            async for chunk in stream:
                if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
                    try:
                        data = json.loads(chunk[6:].strip())
                        logger.info(f"   [FB] {data.get('level', '').upper()}: {data.get('msg', '')}")
                        if data.get("level") == "link":
                            captured_data["permalink"] = data["msg"]
                        if data.get("level") == "post_id":
                            captured_data["post_id"] = data["msg"]
                        if data.get("level") == "success":
                            captured_data["success"] = True
                    except: pass
        
        # 1. CAROUSEL
        if post.post_type == "carousel":
            stream = publish_stream(
                user_token=user_token,
                page_token=page_token,
                page_id=payload["page_id"],
                ad_account_id=payload["ad_account_id"],
                message=payload["message"],
                card1_link=payload["card1_link"],
                card2_link=payload["card2_link"],
                card1_title=payload["card1_title"],
                card2_title=payload["card2_title"],
                card1_desc=payload["card1_desc"],
                card2_desc=payload["card2_desc"],
                card1_cta=payload["card1_cta"],
                card2_cta=payload["card2_cta"],
                video_path=payload["video_file"],
                thumbnail_path=payload["thumbnail_file"],
                image_path=payload["image_file"],
            )
            await mock_event_consumer(stream)
            
        # 2. SINGLE MEDIA
        elif post.post_type == "single":
            stream = publish_single_stream(
                user_token=user_token,
                page_token=page_token,
                page_id=payload["page_id"],
                ad_account_id=payload["ad_account_id"],
                message=payload["message"],
                link=payload["link"],
                display_link=payload["display_link"],
                cta_type=payload["cta_type"],
                media_type=payload["media_type"],
                media_path=payload["media_file"],
                thumbnail_path=payload.get("thumbnail_file"),
            )
            await mock_event_consumer(stream)
            
        # 3. NORMAL
        elif post.post_type == "normal":
            stream = publish_normal_stream(
                page_token=page_token,
                page_id=payload["page_id"],
                message=payload["message"],
                media_type=payload["media_type"],
                media_path=payload["media_file"],
                thumbnail_path=payload.get("thumbnail_file"),
            )
            await mock_event_consumer(stream)
        
        if captured_data["success"]:
            post.status = "published"
            if captured_data["permalink"]:
                post.permalink = captured_data["permalink"]
            if captured_data["post_id"]:
                post.post_id = captured_data["post_id"]
        else:
            post.status = "failed"
            
        db.commit()
        return captured_data["success"]

    except Exception as e:
        logger.exception(f"Lỗi khi thực thi post {post.post_id}: {e}")
        post.status = "failed"
        db.commit()
        return False
