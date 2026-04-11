"""
auth.py — JWT authentication utilities + FastAPI dependencies.

- create_jwt / verify_jwt: tạo / giải mã JWT token
- get_current_user:  FastAPI Dependency — trả về User hoặc raise 401
"""
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, User
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS


def create_jwt(user_id: int) -> str:
    """Tạo JWT token chứa user_id, hết hạn sau JWT_EXPIRE_HOURS."""
    payload = {
        "sub": str(user_id),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt(token: str) -> int | None:
    """Giải mã JWT, trả về user_id (int) hoặc None nếu invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError, ValueError):
        return None


def _extract_token(request: Request) -> str | None:
    """Lấy JWT từ Authorization header hoặc cookie."""
    # 1. Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]

    # 2. Cookie fallback
    token = request.cookies.get("towblock_token")
    if token:
        return token

    return None


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency: lấy current user từ JWT.
    Raise 401 nếu chưa đăng nhập hoặc token invalid.
    """
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Chưa đăng nhập")

    user_id = verify_jwt(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token hết hạn hoặc không hợp lệ")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User không tồn tại")

    return user
