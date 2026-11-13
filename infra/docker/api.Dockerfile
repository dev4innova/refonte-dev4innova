# Backend image. Build context: repository root (like the web image and Railway builds).
FROM python:3.15-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH

RUN pip install --no-cache-dir uv==0.11.32 \
    && useradd --system --uid 10001 --no-create-home app

WORKDIR /app

# Dependencies first for layer caching.
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/api/alembic.ini ./
COPY apps/api/alembic ./alembic
COPY apps/api/app ./app

USER app
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD ["sh", "-c", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:${PORT:-8000}/api/v1/health/live', timeout=2).status == 200 else 1)\""]

# PORT is set by the platform (Railway). An empty host makes asyncio open one socket per
# address family: IPv4 (Railway's health check and public proxy) and IPv6 (Railway's private
# network, used by the web app). "--host ::" would listen on IPv6 only: asyncio sets
# IPV6_V6ONLY, and the health check is then refused. Access logs come from the app (JSON).
CMD ["sh", "-c", "exec uvicorn app.main:app --host '' --port ${PORT:-8000} --no-access-log"]
