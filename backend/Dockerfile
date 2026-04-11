# ═══════════════════════════════════════════════════════════
#  Auto Post Tool Backend — Production Dockerfile
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Build dependencies ──
FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ──
FROM python:3.11-slim

# Metadata
LABEL maintainer="chuong.nv"
LABEL description="Auto Post Tool — Facebook Publisher Backend"

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps for Playwright (chromium) and opencv-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libnss3 \
        libnspr4 \
        libdbus-1-3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libgbm1 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 \
        libatspi2.0-0 \
        libxshmfence1 \
        libgl1 \
        libgles2 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder stage
COPY --from=builder /install /usr/local

# Install Playwright browsers (Chromium only to keep image small)
RUN playwright install chromium

# Copy application source code
COPY . .

# Create uploads directory & data volume mount point
RUN mkdir -p /app/uploads /app/data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
