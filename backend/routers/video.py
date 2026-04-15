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
from typing import Optional

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
FRAMES_DIR = os.path.join(UPLOAD_DIR, "frames")
os.makedirs(FRAMES_DIR, exist_ok=True)


@router.post("/api/video/extract-frames")
@router.post("/api/tools/extract-frames")
async def extract_frames(
    video: Optional[UploadFile] = File(None),
    video_file: Optional[UploadFile] = File(None),
):
    """
    Upload video → extract 5 frame ngẫu nhiên → trả về base64 images.
    """
    if video is None:
        video = video_file
    if video is None:
        raise HTTPException(status_code=422, detail="Thiếu file video (field 'video' hoặc 'video_file').")

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

        # Chọn 5 vị trí trải đều từ đầu → cuối (tránh frame đầu/cuối quá sát)
        # Mục tiêu: 5 frame khác nhau rõ rệt, ổn định hơn so với random.
        margin = max(1, total_frames // 20)  # ~5% margin
        start = margin
        end = max(margin, total_frames - margin - 1)
        if end <= start:
            start = 0
            end = max(0, total_frames - 1)

        n = 5
        if n == 1 or end == start:
            positions = [start]
        else:
            step = (end - start) / (n - 1)
            positions = [int(round(start + i * step)) for i in range(n)]
            # De-dupe nếu rounding trùng nhau (video rất ngắn)
            positions = sorted({min(max(p, 0), total_frames - 1) for p in positions})
            while len(positions) < n:
                cand = positions[-1] + 1
                if cand >= total_frames:
                    break
                positions.append(cand)
            positions = positions[:n]

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
