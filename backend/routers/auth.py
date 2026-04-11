"""
routers/auth.py — Facebook OAuth login + JWT session management.

Endpoints:
  GET  /api/auth/login    — redirect user đến Facebook OAuth dialog
  GET  /api/auth/callback — Facebook redirect về, đổi code → token → tạo user
  GET  /api/auth/me       — trả thông tin user hiện tại
  POST /api/auth/logout   — xóa JWT cookie
"""
import requests
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from database import get_db, User, FacebookApp, Page
from auth import create_jwt, get_current_user
from config import FRONTEND_URL, BACKEND_URL
from services.facebook import fetch_user_info, fetch_pages, fetch_ad_accounts

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _get_active_app(db: Session) -> FacebookApp:
    """Lấy Facebook App đang active. Raise 500 nếu chưa cấu hình."""
    app = db.query(FacebookApp).filter(FacebookApp.is_active == True).first()
    if not app:
        raise HTTPException(
            status_code=500,
            detail="Chưa cấu hình Facebook App. Admin cần thêm App trước.",
        )
    return app


@router.get("/login")
def login(next: str = "/", db: Session = Depends(get_db)):
    """Redirect user đến Facebook OAuth dialog."""
    app = _get_active_app(db)
    # Encode 'next' path vào state param để callback biết redirect về đâu
    import urllib.parse
    redirect_uri = f"{BACKEND_URL}/api/auth/callback"
    state = urllib.parse.quote(next)  # /admin → %2Fadmin

    fb_auth_url = (
        f"https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={app.app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=pages_show_list,pages_manage_posts,pages_read_engagement,"
        f"ads_management,ads_read,business_management"
        f"&response_type=code"
        f"&state={state}"
    )
    return RedirectResponse(url=fb_auth_url)


@router.get("/callback")
def callback(code: str = None, error: str = None, state: str = "/", db: Session = Depends(get_db)):
    """
    Facebook redirect về endpoint này với ?code=...&state=...
    Đổi code → short-lived token → long-lived token → tạo/cập nhật User.
    """
    import urllib.parse
    return_path = urllib.parse.unquote(state or "/")
    if error or not code:
        return RedirectResponse(url=f"{FRONTEND_URL}{return_path}?auth_error={error or 'no_code'}")

    app = _get_active_app(db)
    redirect_uri = f"{BACKEND_URL}/api/auth/callback"

    # ── Step 1: Exchange code → short-lived token ──
    token_res = requests.get(
        "https://graph.facebook.com/v19.0/oauth/access_token",
        params={
            "client_id": app.app_id,
            "client_secret": app.app_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        },
        timeout=15,
    ).json()

    short_token = token_res.get("access_token")
    if not short_token:
        return RedirectResponse(
            url=f"{FRONTEND_URL}{return_path}?auth_error=token_exchange_failed"
        )

    # ── Step 2: Exchange short-lived → long-lived token ──
    ll_res = requests.get(
        "https://graph.facebook.com/v19.0/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": app.app_id,
            "client_secret": app.app_secret,
            "fb_exchange_token": short_token,
        },
        timeout=15,
    ).json()

    access_token = ll_res.get("access_token", short_token)
    expires_in = ll_res.get("expires_in")  # seconds, ~60 ngày cho long-lived

    token_expires_at = None
    if expires_in:
        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # ── Step 3: Fetch user info ──
    user_info = fetch_user_info(access_token)
    if "error" in user_info:
        return RedirectResponse(
            url=f"{FRONTEND_URL}{return_path}?auth_error=invalid_token"
        )

    fb_user_id = user_info["id"]
    user_name = user_info.get("name", "")

    # Fetch avatar
    avatar_url = f"https://graph.facebook.com/{fb_user_id}/picture?type=large"

    # ── Step 4: Fetch ad accounts ──
    ad_accounts = fetch_ad_accounts(access_token)
    ad_account_id = None
    can_use_ads = False
    if ad_accounts and len(ad_accounts) > 0:
        ad_account_id = ad_accounts[0].get("id")  # lấy ad account đầu tiên
        can_use_ads = True

    # ── Step 5: Create or update User ──
    user = db.query(User).filter(User.fb_user_id == fb_user_id).first()

    # User đầu tiên = admin
    is_first_user = db.query(User).count() == 0

    if user:
        # Update existing user
        user.name = user_name
        user.avatar_url = avatar_url
        user.access_token = access_token
        user.ad_account_id = ad_account_id
        user.can_use_ads = can_use_ads
        user.token_expires_at = token_expires_at
    else:
        # Create new user
        user = User(
            fb_user_id=fb_user_id,
            name=user_name,
            avatar_url=avatar_url,
            access_token=access_token,
            ad_account_id=ad_account_id,
            can_use_ads=can_use_ads,
            token_expires_at=token_expires_at,
            is_admin=is_first_user,  # user đầu tiên tự động là admin
        )
        db.add(user)
        db.flush()  # để có user.id

    # ── Step 6: Fetch & save pages ──
    pages_data = fetch_pages(access_token)

    # Xóa pages cũ của user này, thay bằng mới
    db.query(Page).filter(Page.user_id == user.id).delete()
    for pd in pages_data:
        db.add(Page(
            page_id=pd["page_id"],
            page_name=pd["page_name"],
            page_access_token=pd["page_token"],
            user_id=user.id,
        ))

    db.commit()

    print(f"[AUTH] ✅ Login: {user_name} (fb_id={fb_user_id}), "
          f"pages={len(pages_data)}, ads={can_use_ads}, admin={user.is_admin}")

    # ── Step 7: Create JWT & redirect to frontend ──
    jwt_token = create_jwt(user.id)

    # Token trả về qua URL param → frontend lưu vào localStorage
    return RedirectResponse(url=f"{FRONTEND_URL}/?token={jwt_token}")


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    """Trả thông tin user hiện tại."""
    return {
        "id": user.id,
        "fb_user_id": user.fb_user_id,
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "ad_account_id": user.ad_account_id,
        "can_use_ads": user.can_use_ads,
        "is_admin": user.is_admin,
        "token_expires_at": user.token_expires_at.isoformat() if user.token_expires_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/logout")
def logout():
    """Xóa JWT cookie."""
    response = JSONResponse(content={"ok": True})
    response.delete_cookie(key="autopost_token", path="/")
    return response


@router.post("/delete-data")
def delete_data(request: Request, db: Session = Depends(get_db)):
    """
    Data Deletion Request URL — bắt buộc bởi Facebook App Review.
    Facebook gửi signed_request khi user yêu cầu xóa dữ liệu.
    Xóa user + tất cả data liên quan (pages, posts).
    """
    import hashlib, hmac, base64, json as json_mod

    form_data = None
    try:
        # Facebook gửi POST form-encoded
        import asyncio
        form_data = asyncio.get_event_loop().run_until_complete(request.form())
    except Exception:
        pass

    signed_request = form_data.get("signed_request") if form_data else None

    if not signed_request:
        return JSONResponse(
            status_code=200,
            content={
                "url": f"{FRONTEND_URL}/data-deleted",
                "confirmation_code": "no_signed_request",
            },
        )

    # Decode signed_request
    try:
        encoded_sig, payload = signed_request.split(".", 1)
        data = json_mod.loads(base64.urlsafe_b64decode(payload + "=="))
        fb_user_id = data.get("user_id")
    except Exception:
        fb_user_id = None

    if fb_user_id:
        user = db.query(User).filter(User.fb_user_id == str(fb_user_id)).first()
        if user:
            confirmation = f"del_{user.id}_{fb_user_id}"
            db.delete(user)  # cascade xóa pages + posts
            db.commit()
            print(f"[DATA-DELETE] ✅ Deleted user fb_id={fb_user_id}")
            return JSONResponse(content={
                "url": f"{FRONTEND_URL}/data-deleted?code={confirmation}",
                "confirmation_code": confirmation,
            })

    return JSONResponse(content={
        "url": f"{FRONTEND_URL}/data-deleted",
        "confirmation_code": "user_not_found",
    })
