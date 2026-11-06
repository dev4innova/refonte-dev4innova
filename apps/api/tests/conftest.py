"""Test configuration. Uses a real PostgreSQL and Redis (docs/rules/backend.md).

Override with TEST_DATABASE_URL / TEST_REDIS_URL; defaults match the Docker Compose services.
"""

import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://dev4innova:dev4innova@localhost:5432/dev4innova_test",
)
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")

from app.core.config import get_settings
from app.core.redis import close_redis
from app.db.session import dispose_engine
from app.main import create_app


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    get_settings.cache_clear()
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    await dispose_engine()
    await close_redis()
