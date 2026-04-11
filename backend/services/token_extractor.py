"""
token_extractor.py — Playwright chạy trong thread riêng với ProactorEventLoop (Windows fix).

Vấn đề: uvicorn dùng SelectorEventLoop, không hỗ trợ subprocess trên Windows.
Giải pháp: Chạy Playwright trong ThreadPoolExecutor → asyncio.run() → ProactorEventLoop tự động.
Giao tiếp qua thread-safe queue.Queue.
"""
import asyncio
import json
import queue
import re
from typing import AsyncGenerator

TOKEN_RE = re.compile(r'EAA[A-Za-z0-9]{50,}')

URLS_TO_VISIT = [
    "https://adsmanager.facebook.com/",
    "https://business.facebook.com/adsmanager/",
    "https://www.facebook.com/ads/manager/",
]


# ─────────────────────────────────────────────
#  Chạy toàn bộ Playwright trong thread riêng
#  asyncio.run() trên Windows tự dùng ProactorEventLoop
# ─────────────────────────────────────────────

def _run_playwright_sync(raw_cookies: list[dict], msg_queue: queue.Queue):
    """Entry point của thread — gọi asyncio.run() để có ProactorEventLoop."""
    asyncio.run(_playwright_main(raw_cookies, msg_queue))


async def _playwright_main(raw_cookies: list[dict], msg_queue: queue.Queue):
    """Logic Playwright chạy trong ProactorEventLoop."""
    from playwright.async_api import async_playwright

    def emit(level: str, msg: str):
        line = f"data: {json.dumps({'level': level, 'msg': msg})}\n\n"
        msg_queue.put(line)
        print(f"[EXTRACT][{level.upper()}] {msg}")

    captured_token = None
    captured_account_id = None

    try:
        emit("info", "🚀 Khởi động trình duyệt ẩn (Playwright Chromium)...")

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                ]
            )

            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )

            # Inject cookies từ extension
            emit("info", f"🍪 Đang inject {len(raw_cookies)} cookies vào browser...")
            playwright_cookies = []
            for c in raw_cookies:
                cookie = {
                    "name":     c.get("name", ""),
                    "value":    c.get("value", ""),
                    "domain":   c.get("domain", ".facebook.com"),
                    "path":     c.get("path", "/"),
                    "httpOnly": c.get("httpOnly", False),
                    "secure":   c.get("secure", True),
                    "sameSite": "None",
                }
                if c.get("expirationDate"):
                    cookie["expires"] = int(c["expirationDate"])
                playwright_cookies.append(cookie)

            await context.add_cookies(playwright_cookies)
            emit("success", "✅ Đã inject cookies thành công")

            # Intercept network requests để bắt token
            found_event = asyncio.Event()

            async def intercept(request):
                nonlocal captured_token, captured_account_id
                if found_event.is_set():
                    return
                url     = request.url
                headers = request.headers

                # Tìm token trong URL
                match = TOKEN_RE.search(url)
                if not match:
                    auth  = headers.get("authorization", "")
                    match = TOKEN_RE.search(auth)
                if not match:
                    for v in headers.values():
                        match = TOKEN_RE.search(str(v))
                        if match:
                            break

                if match:
                    token = match.group(0)
                    if len(token) >= 80 and captured_token is None:
                        captured_token = token
                        found_event.set()

                # Tìm act_XXXXXXXXX trong URL
                if captured_account_id is None:
                    act_m = re.search(r'act_(\d{10,})', url)
                    if act_m:
                        captured_account_id = f"act_{act_m.group(1)}"

            context.on("request", intercept)
            page = await context.new_page()

            for target_url in URLS_TO_VISIT:
                if found_event.is_set():
                    break
                emit("info", f"🌐 Đang mở {target_url}...")
                try:
                    await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
                    current_url = page.url
                    if "login" in current_url or "checkpoint" in current_url:
                        emit("error", "⚠️ Cookie đã hết hạn — Đăng nhập Facebook lại rồi thử!")
                        break

                    emit("info", "⏳ Chờ Ads Manager gửi API request (tối đa 20s)...")
                    try:
                        await asyncio.wait_for(found_event.wait(), timeout=20.0)
                        if found_event.is_set():
                            break
                    except asyncio.TimeoutError:
                        emit("info", "  → Chưa bắt được, thử URL khác...")
                except Exception as nav_err:
                    emit("info", f"  → Lỗi navigate: {str(nav_err)[:80]}")

            # Fallback: tìm act_ trong HTML nếu chưa có
            if captured_token and not captured_account_id:
                try:
                    content = await page.content()
                    acts = re.findall(r'act_(\d{10,})', content)
                    if acts:
                        captured_account_id = f"act_{acts[0]}"
                except Exception:
                    pass

            # ── FETCH PAGES trực tiếp qua Graph API trong browser ──
            captured_pages = []
            if captured_token:
                emit("info", "📄 Đang fetch danh sách Fanpage qua Graph API...")
                try:
                    api_url = (
                        f"https://graph.facebook.com/v19.0/me/accounts"
                        f"?access_token={captured_token}"
                    )
                    await page.goto(api_url, wait_until="domcontentloaded", timeout=15000)
                    body_text = await page.inner_text("body")
                    api_res = json.loads(body_text)

                    if "error" in api_res:
                        emit("info", f"⚠️ Graph API /me/accounts: {api_res['error'].get('message', 'unknown error')}")
                        # Fallback: thử lại với fields cụ thể
                        api_url2 = (
                            f"https://graph.facebook.com/v19.0/me/accounts"
                            f"?fields=id,name,access_token"
                            f"&access_token={captured_token}"
                        )
                        await page.goto(api_url2, wait_until="domcontentloaded", timeout=15000)
                        body_text2 = await page.inner_text("body")
                        api_res = json.loads(body_text2)

                    for pg in api_res.get("data", []):
                        captured_pages.append({
                            "page_id":    pg.get("id", ""),
                            "page_name":  pg.get("name", "Unknown"),
                            "page_token": pg.get("access_token", ""),
                        })

                    if captured_pages:
                        emit("success", f"✅ Tìm thấy {len(captured_pages)} Fanpage!")
                        for pg in captured_pages:
                            emit("info", f"  📌 {pg['page_name']} (ID: {pg['page_id']})")
                    else:
                        emit("info", "⚠️ Token không có quyền truy cập pages — hãy dùng Setup token thủ công")
                except Exception as pages_err:
                    emit("info", f"⚠️ Lỗi fetch pages: {str(pages_err)[:100]}")

            await browser.close()

            if captured_token:
                emit("success", f"🎉 Bắt được Token! (độ dài: {len(captured_token)} ký tự)")
                if captured_account_id:
                    emit("success", f"📦 AD Account ID: {captured_account_id}")
                else:
                    emit("info", "⚠️ Không tìm thấy AD Account ID — nhập thủ công sau")
                msg_queue.put(
                    f"data: {json.dumps({'level': 'result', 'token': captured_token, 'ad_account_id': captured_account_id or '', 'pages': captured_pages})}\n\n"
                )
            else:
                emit("error", "❌ Không bắt được token.")
                emit("info", "💡 Thử: Mở Facebook Ads Manager thủ công trước, rồi bấm 'Lấy Token' lại.")

    except Exception as ex:
        msg_queue.put(
            f"data: {json.dumps({'level': 'error', 'msg': f'💥 Lỗi Playwright: {str(ex)}'})}\n\n"
        )
        print(f"[EXTRACT][ERROR] Playwright exception: {ex}")

    finally:
        msg_queue.put("data: [DONE]\n\n")


# ─────────────────────────────────────────────
#  Async generator — bridge queue → SSE
# ─────────────────────────────────────────────

async def extract_token_stream(raw_cookies: list[dict]) -> AsyncGenerator[str, None]:
    """
    Chạy Playwright trong ThreadPoolExecutor (thread có ProactorEventLoop riêng).
    Bridge kết quả về async generator qua thread-safe queue.Queue.
    """
    msg_queue: queue.Queue = queue.Queue()
    loop = asyncio.get_event_loop()

    # Gửi Playwright vào thread pool — thread này dùng asyncio.run() → ProactorEventLoop
    future = loop.run_in_executor(None, _run_playwright_sync, raw_cookies, msg_queue)

    while True:
        # Poll queue non-blocking, nhường CPU khi rỗng
        try:
            item = msg_queue.get_nowait()
        except queue.Empty:
            # Kiểm tra thread đã xong chưa
            if future.done():
                # Drain phần còn lại
                while not msg_queue.empty():
                    yield msg_queue.get_nowait()
                break
            await asyncio.sleep(0.05)
            continue

        yield item
        if item.strip() == "data: [DONE]":
            break

    # Đảm bảo future kết thúc sạch
    try:
        await asyncio.wait_for(future, timeout=5.0)
    except (asyncio.TimeoutError, Exception):
        pass
