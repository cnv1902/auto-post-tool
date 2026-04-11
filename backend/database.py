"""
database.py — SQLAlchemy models cho Auto Post Tool multi-user system.

Models:
  - User         : Facebook user đã đăng nhập
  - FacebookApp  : Facebook App credentials (admin quản lý)
  - Page         : Fanpage thuộc về user
  - Post         : Bài viết đã đăng, thuộc về user
"""
from sqlalchemy import (
    create_engine, Column, String, Integer, Boolean,
    DateTime, Text, ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

DB_DIR = os.environ.get("DB_DIR", os.path.dirname(__file__))
DB_PATH = os.path.join(DB_DIR, "autopost.db")
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ──────────────────────────────────────────────
#  User — Facebook user đã đăng nhập OAuth
# ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    fb_user_id      = Column(String, unique=True, nullable=False, index=True)
    name            = Column(String, nullable=False, default="")
    email           = Column(String, nullable=True)
    avatar_url      = Column(String, nullable=True)
    access_token    = Column(Text, nullable=False)          # USER access token
    ad_account_id   = Column(String, nullable=True)         # act_XXXXXXX
    can_use_ads     = Column(Boolean, default=False)        # có quyền ads_management?
    token_expires_at = Column(DateTime, nullable=True)      # khi nào hết hạn
    is_admin        = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

    # Relationships
    pages = relationship("Page", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
#  FacebookApp — credentials do admin quản lý
# ──────────────────────────────────────────────
class FacebookApp(Base):
    __tablename__ = "facebook_apps"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    app_id      = Column(String, unique=True, nullable=False)
    app_secret  = Column(String, nullable=False)
    app_name    = Column(String, nullable=False, default="")
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ──────────────────────────────────────────────
#  Page — Fanpage thuộc về user
# ──────────────────────────────────────────────
class Page(Base):
    __tablename__ = "pages"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    page_id         = Column(String, nullable=False, index=True)
    page_name       = Column(String, nullable=False)
    page_access_token = Column(Text, nullable=False)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="pages")


# ──────────────────────────────────────────────
#  Post — Bài viết đã đăng, thuộc về user
# ──────────────────────────────────────────────
class Post(Base):
    __tablename__ = "posts"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    post_id       = Column(String, nullable=False, index=True)
    page_id       = Column(String, nullable=False)
    page_name     = Column(String, nullable=False, default="")
    message       = Column(Text, nullable=False, default="")
    permalink     = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    status        = Column(String, nullable=False, default="published") # published, scheduled, failed
    
    # ── Scheduler support ──
    scheduled_time = Column(Integer, nullable=True) # Unix timestamp
    payload        = Column(Text, nullable=True)    # JSON string
    post_type      = Column(String, nullable=True)  # 'carousel', 'single', 'normal'
    
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="posts")


# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────
def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
