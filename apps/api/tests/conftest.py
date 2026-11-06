"""Test configuration. Uses a real PostgreSQL and Redis (docs/rules/backend.md).

Override with TEST_DATABASE_URL / TEST_REDIS_URL; defaults match the Docker Compose services.
"""

import os
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://dev4innova:dev4innova@localhost:5432/dev4innova_test",
)
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.config import get_settings
from app.core.redis import close_redis
from app.db.session import dispose_engine, get_engine
from app.main import create_app
from app.modules.identity.auth import get_token_verifier
from tests.auth_helpers import bearer, make_token, make_verifier

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    """Applies the real migrations once: tests run against the production schema."""
    command.upgrade(Config(str(API_ROOT / "alembic.ini")), "head")


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    get_settings.cache_clear()
    app = create_app()
    app.dependency_overrides[get_token_verifier] = make_verifier
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    async with get_engine().begin() as conn:
        await conn.execute(text("TRUNCATE memberships, organizations, users CASCADE"))
    await dispose_engine()
    await close_redis()


@dataclass
class Actor:
    """A signed-in user: `headers` carry a valid access token."""

    subject: str
    email: str
    headers: dict[str, str]
    id: str = ""


@pytest.fixture
def sign_in(client: AsyncClient) -> Callable[[str], Awaitable[Actor]]:
    """Creates a user through the real flow: a token, then GET /me (JIT provisioning)."""

    async def _sign_in(name: str) -> Actor:
        email = f"{name}@example.com"
        token = make_token(f"sub-{name}", email=email, name=name.capitalize())
        actor = Actor(subject=f"sub-{name}", email=email, headers=bearer(token))
        response = await client.get("/api/v1/me", headers=actor.headers)
        assert response.status_code == 200, response.text
        actor.id = response.json()["id"]
        return actor

    return _sign_in
