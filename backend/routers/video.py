"""
POST /api/video/extract-frames — Nhận file video, extract 5 frame ngẫu nhiên
Trả về mảng base64 JPG để frontend hiển thị cho user chọn thumbnail.
"""
import os
import uuid
import base64
import random
import cv2
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
FRAMES_DIR = os.path.join(UPLOAD_DIR, "frames")
os.makedirs(FRAMES_DIR, exist_ok=True)


@router.post("/api/video/extract-frames")
async def extract_frames(video: UploadFile = File(...)):
    """
    Upload video → extract 5 frame ngẫu nhiên → trả về base64 images.
    """
    # Lưu video tạm
    tmp_name = f"{uuid.uuid4().hex}.mp4"
    tmp_path = os.path.abspath(os.path.join(UPLOAD_DIR, tmp_name))

    try:
        content = await video.read()
        with open(tmp_path, "wb") as f:
            f.write(content)

        # Mở video bằng OpenCV
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Không thể mở video. Kiểm tra định dạng file.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames < 5:
            raise HTTPException(status_code=400, detail=f"Video quá ngắn ({total_frames} frames). Cần ít nhất 5 frames.")

        # Chọn 5 vị trí ngẫu nhiên (tránh frame đầu/cuối quá gần)
        margin = max(1, total_frames // 20)  # 5% margin
        positions = sorted(random.sample(range(margin, total_frames - margin), min(5, total_frames - 2 * margin)))

        frames_b64 = []
        for pos in positions:
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ret, frame = cap.read()
            if not ret:
                continue

            # Resize nếu quá lớn (giữ aspect ratio, max width 640)
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640 / w
                frame = cv2.resize(frame, (640, int(h * scale)))

            # Encode thành JPEG base64
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            b64 = base64.b64encode(buffer).decode('utf-8')
            frames_b64.append(f"data:image/jpeg;base64,{b64}")

        cap.release()

        if len(frames_b64) == 0:
            raise HTTPException(status_code=500, detail="Không thể extract frame nào từ video.")

        return {"frames": frames_b64, "total_frames": total_frames}

    finally:
        # Xóa file video tạm
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
