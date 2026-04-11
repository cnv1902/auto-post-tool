"""
config.py — Tập trung mọi cấu hình hệ thống, load từ .env

Tất cả module khác import config từ đây, KHÔNG dùng os.environ trực tiếp.
"""
import os
from dotenv import load_dotenv

# Load .env file từ thư mục backend
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── URLs ──
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

# ── CORS ──
_cors_raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]

# ── Admin ──
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "@Cchuong1009")

# ── JWT ──
JWT_SECRET = os.environ.get("JWT_SECRET", "autopost-jwt-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72  # 3 ngày

ADMIN_JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET", "autopost-admin-secret-change-in-prod")
ADMIN_JWT_HOURS = 24 * 7  # 7 ngày
