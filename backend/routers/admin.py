"""
routers/admin.py — Admin endpoints.

Admin login bằng password cứng (cnv1902), KHÔNG phụ thuộc Facebook OAuth.

Endpoints:
  POST   /api/admin/login              — đăng nhập admin
  GET    /api/admin/verify             — kiểm tra admin token
  GET    /api/admin/users              — danh sách users
  DELETE /api/admin/users/{id}         — xóa user + cascade data
  GET    /api/admin/apps               — danh sách Facebook Apps
  POST   /api/admin/apps               — thêm App mới
  PUT    /api/admin/apps/{id}          — cập nhật App
  DELETE /api/admin/apps/{id}          — xóa App
"""
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, User, FacebookApp, Page, Post
from config import ADMIN_PASSWORD, ADMIN_JWT_SECRET, ADMIN_JWT_HOURS, JWT_ALGORITHM

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ──────────────────────────────────────────────
#  Admin auth
# ──────────────────────────────────────────────


def _create_admin_token() -> str:
    payload = {
        "role": "admin",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=ADMIN_JWT_HOURS),
    }
    return jwt.encode(payload, ADMIN_JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_admin_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("role") == "admin"
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return False


def _require_admin(request: Request):
    """Dependency: kiểm tra admin token từ Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chưa đăng nhập admin")
    token = auth[7:]
    if not _verify_admin_token(token):
        raise HTTPException(status_code=401, detail="Admin token hết hạn hoặc không hợp lệ")


# ──────────────────────────────────────────────
#  LOGIN
# ──────────────────────────────────────────────

class AdminLoginPayload(BaseModel):
    password: str


@router.post("/login")
def admin_login(payload: AdminLoginPayload):
    """Đăng nhập admin bằng password."""
    if payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Sai mật khẩu")
    token = _create_admin_token()
    return {"ok": True, "token": token}


@router.get("/verify")
def admin_verify(request: Request):
    """Kiểm tra admin token còn hợp lệ không."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and _verify_admin_token(auth[7:]):
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Token không hợp lệ")


# ──────────────────────────────────────────────
#  USERS
# ──────────────────────────────────────────────

@router.get("/users")
def list_users(
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "users": [
            {
                "id":             u.id,
                "fb_user_id":     u.fb_user_id,
                "name":           u.name,
                "email":          u.email,
                "avatar_url":     u.avatar_url,
                "ad_account_id":  u.ad_account_id,
                "can_use_ads":    u.can_use_ads,
                "is_admin":       u.is_admin,
                "pages_count":    db.query(Page).filter(Page.user_id == u.id).count(),
                "posts_count":    db.query(Post).filter(Post.user_id == u.id).count(),
                "created_at":     u.created_at.isoformat() if u.created_at else None,
                "token_expires_at": u.token_expires_at.isoformat() if u.token_expires_at else None,
            }
            for u in users
        ],
        "total": len(users),
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại.")
    db.delete(user)
    db.commit()
    return {"deleted": True, "user_id": user_id}


# ──────────────────────────────────────────────
#  FACEBOOK APPS
# ──────────────────────────────────────────────

class AppPayload(BaseModel):
    app_id:    str
    app_secret: str
    app_name:  str = ""
    is_active: bool = True


@router.get("/apps")
def list_apps(
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    apps = db.query(FacebookApp).order_by(FacebookApp.created_at.desc()).all()
    return {
        "apps": [
            {
                "id":        a.id,
                "app_id":    a.app_id,
                "app_secret": a.app_secret[:8] + "..." if len(a.app_secret) > 8 else "***",
                "app_name":  a.app_name,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in apps
        ],
        "total": len(apps),
    }


@router.post("/apps")
def create_app(
    payload: AppPayload,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    existing = db.query(FacebookApp).filter(FacebookApp.app_id == payload.app_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"App ID {payload.app_id} đã tồn tại.")
    app = FacebookApp(
        app_id=payload.app_id,
        app_secret=payload.app_secret,
        app_name=payload.app_name or f"App {payload.app_id}",
        is_active=payload.is_active,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return {"id": app.id, "app_id": app.app_id, "app_name": app.app_name}


class AppUpdatePayload(BaseModel):
    app_secret: Optional[str] = None
    app_name:   Optional[str] = None
    is_active:  Optional[bool] = None


@router.put("/apps/{app_db_id}")
def update_app(
    app_db_id: int,
    payload: AppUpdatePayload,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    app = db.query(FacebookApp).filter(FacebookApp.id == app_db_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App không tồn tại.")
    if payload.app_secret is not None:
        app.app_secret = payload.app_secret
    if payload.app_name is not None:
        app.app_name = payload.app_name
    if payload.is_active is not None:
        app.is_active = payload.is_active
    db.commit()
    return {"updated": True, "id": app.id}


@router.delete("/apps/{app_db_id}")
def delete_app(
    app_db_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    app = db.query(FacebookApp).filter(FacebookApp.id == app_db_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App không tồn tại.")
    db.delete(app)
    db.commit()
    return {"deleted": True, "id": app_db_id}
