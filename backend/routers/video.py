"""
POST /api/video/extract-frames — Nhận file video, extract 5 frame ngẫu nhiên
Trả về mảng base64 JPG để frontend hiển thị cho user chọn thumbnail.
"""
import os
import uuid
import base64
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

    # Lưu video tạm, ưu tiên giữ extension gốc để decoder nhận diện tốt hơn.
    ext = os.path.splitext(video.filename or "")[1].lower()
    if ext not in {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".3gp"}:
        ext = ".mp4"
    tmp_name = f"{uuid.uuid4().hex}{ext}"
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

        # Một số codec/container trả CAP_PROP_FRAME_COUNT = 0 dù video hợp lệ.
        # Khi đó fallback quét tuần tự một đoạn đầu video để lấy frame.
        if total_frames <= 0:
            sampled_frames = []
            max_scan = 300
            scan_idx = 0

            while scan_idx < max_scan:
                ret, frame = cap.read()
                if not ret:
                    break
                if scan_idx % 10 == 0:
                    sampled_frames.append(frame)
                scan_idx += 1

            if not sampled_frames:
                raise HTTPException(status_code=400, detail="Không đọc được frame nào từ video.")

            picked = sampled_frames[:5]
            frames_b64 = []
            for frame in picked:
                h, w = frame.shape[:2]
                if w > 640:
                    scale = 640 / w
                    frame = cv2.resize(frame, (640, int(h * scale)))

                ok, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if not ok:
                    continue
                b64 = base64.b64encode(buffer).decode('utf-8')
                frames_b64.append(f"data:image/jpeg;base64,{b64}")

            cap.release()

            if len(frames_b64) == 0:
                raise HTTPException(status_code=500, detail="Không thể extract frame nào từ video.")

            return {"frames": frames_b64, "total_frames": 0}

        # Chọn tối đa 5 vị trí trải đều từ đầu → cuối.
        n = min(5, max(total_frames, 1))
        margin = max(0, total_frames // 20)
        start = min(margin, max(total_frames - 1, 0))
        end = max(start, total_frames - margin - 1)

        if n == 1 or end == start:
            positions = [start]
        else:
            step = (end - start) / (n - 1)
            positions = [int(round(start + i * step)) for i in range(n)]
            positions = sorted({min(max(p, 0), total_frames - 1) for p in positions})

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
            ok, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not ok:
                continue
            b64 = base64.b64encode(buffer).decode('utf-8')
            frames_b64.append(f"data:image/jpeg;base64,{b64}")

        # Fallback: một số codec mở được metadata nhưng seek theo frame thất bại.
        # Khi đó đọc tuần tự để cố gắng lấy đủ frame.
        if len(frames_b64) == 0:
            cap.release()
            cap = cv2.VideoCapture(tmp_path)
            sequential = []
            idx = 0
            max_scan = min(max(total_frames, 300), 2000)
            while idx < max_scan:
                ret, frame = cap.read()
                if not ret:
                    break
                if idx % 8 == 0:
                    h, w = frame.shape[:2]
                    if w > 640:
                        scale = 640 / w
                        frame = cv2.resize(frame, (640, int(h * scale)))
                    ok, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if ok:
                        b64 = base64.b64encode(buffer).decode('utf-8')
                        sequential.append(f"data:image/jpeg;base64,{b64}")
                        if len(sequential) >= 5:
                            break
                idx += 1
            frames_b64 = sequential

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
