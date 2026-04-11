"""
routers/bootstrap.py — First-time setup endpoints (NO AUTH REQUIRED).

Giải quyết chicken-and-egg problem:
  - Muốn login → cần có Facebook App trong DB
  - Muốn thêm App → cần login admin
  → Endpoint bootstrap cho phép thêm App đầu tiên khi chưa có user/app nào.

Endpoints:
  GET  /api/bootstrap/status  — kiểm tra hệ thống đã setup chưa
  POST /api/bootstrap/app     — thêm Facebook App đầu tiên (chỉ khi chưa có app)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, User, FacebookApp

router = APIRouter(prefix="/api/bootstrap", tags=["bootstrap"])


@router.get("/status")
def bootstrap_status(db: Session = Depends(get_db)):
    """
    Public endpoint — trả về trạng thái hệ thống.
    Frontend dùng để quyết định hiện trang nào:
      - needs_setup=true  → hiện form thêm Facebook App
      - needs_setup=false → hiện trang Login
    """
    apps_count = db.query(FacebookApp).count()
    users_count = db.query(User).count()
    has_active_app = db.query(FacebookApp).filter(FacebookApp.is_active == True).count() > 0

    return {
        "needs_setup": apps_count == 0,  # chưa có app nào
        "has_active_app": has_active_app,
        "apps_count": apps_count,
        "users_count": users_count,
    }


class BootstrapAppPayload(BaseModel):
    app_id: str
    app_secret: str
    app_name: str = ""


@router.post("/app")
def bootstrap_create_app(
    payload: BootstrapAppPayload,
    db: Session = Depends(get_db),
):
    """
    Public endpoint — chỉ hoạt động khi chưa có Facebook App nào trong DB.
    Sau khi có App đầu tiên, endpoint này sẽ bị khóa (trả 403).
    """
    existing_count = db.query(FacebookApp).count()
    if existing_count > 0:
        raise HTTPException(
            status_code=403,
            detail="Hệ thống đã được cấu hình. Dùng Admin panel để quản lý Apps.",
        )

    if not payload.app_id or not payload.app_secret:
        raise HTTPException(status_code=400, detail="App ID và App Secret là bắt buộc.")

    app = FacebookApp(
        app_id=payload.app_id.strip(),
        app_secret=payload.app_secret.strip(),
        app_name=payload.app_name.strip() or f"App {payload.app_id.strip()}",
        is_active=True,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    print(f"[BOOTSTRAP] ✅ Facebook App created: {app.app_name} (ID: {app.app_id})")

    return {
        "ok": True,
        "app_id": app.app_id,
        "app_name": app.app_name,
        "message": "Facebook App đã được thêm. Bạn có thể đăng nhập ngay.",
    }
