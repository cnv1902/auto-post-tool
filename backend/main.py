from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import os

from config import CORS_ORIGINS
from database import init_db
from routers import setup, pages, publish, extract, video, posts, auth, admin, bootstrap

app = FastAPI(title="Auto Post Tool — Facebook Publisher", version="2.0.0")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    # Log rõ field nào thiếu/không hợp lệ để debug nhanh các lỗi 422 multipart/form-data
    print(f"[422][VALIDATION] {request.method} {request.url}")
    try:
        print(exc.errors())
    except Exception:
        pass
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# CORS — load origins từ .env
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files — phục vụ uploads (frames, etc.)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


import asyncio
from scheduler import background_scheduler_loop

# Init DB khi startup
@app.on_event("startup")
def on_startup():
    init_db()
    asyncio.create_task(background_scheduler_loop())


# ── Routers ──
app.include_router(auth.router)
app.include_router(bootstrap.router)
app.include_router(admin.router)
app.include_router(setup.router)
app.include_router(pages.router)
app.include_router(publish.router)
app.include_router(extract.router)
app.include_router(posts.router)
app.include_router(video.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
