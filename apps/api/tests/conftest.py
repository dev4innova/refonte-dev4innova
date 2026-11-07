"""Test configuration. Uses a real PostgreSQL and Redis (docs/rules/backend.md).

Override with TEST_DATABASE_URL / TEST_REDIS_URL; defaults match the Docker Compose services.
"""

import os
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
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
from app.core.redis import close_redis, get_redis
from app.core.storage import ObjectStorage, get_storage
from app.db.session import dispose_engine, get_engine
from app.main import create_app
from app.modules.identity.auth import get_token_verifier
from tests.auth_helpers import bearer, make_token, make_verifier

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    """Applies the real migrations once: tests run against the production schema."""
    command.upgrade(Config(str(API_ROOT / "alembic.ini")), "head")


TEST_BUCKET = "test-media"
TEST_MEDIA_URL = "http://localhost:9000/dev4innova-media"


@pytest.fixture
def storage() -> Iterator[ObjectStorage]:
    """In-memory S3 (moto): uploads are real S3 calls, against a fake service."""
    import boto3
    from moto import mock_aws

    with mock_aws():
        client = boto3.client("s3", region_name="eu-west-1")
        client.create_bucket(
            Bucket=TEST_BUCKET, CreateBucketConfiguration={"LocationConstraint": "eu-west-1"}
        )
        yield ObjectStorage(client, TEST_BUCKET, TEST_MEDIA_URL)


@pytest.fixture
async def client(storage: ObjectStorage) -> AsyncIterator[AsyncClient]:
    get_settings.cache_clear()
    app = create_app()
    app.dependency_overrides[get_token_verifier] = make_verifier
    app.dependency_overrides[get_storage] = lambda: storage
    await get_redis().flushdb()  # test database (15): fresh rate limit counters
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    async with get_engine().begin() as conn:
        # Keep what migrations seeded: the internal organization and the services content.
        for statement in (
            "DELETE FROM cms_documents WHERE NOT (type = 'service' AND created_by_id IS NULL)",
            "UPDATE cms_documents SET cover_media_id = NULL",
            "DELETE FROM cms_media",
            "DELETE FROM contact_requests",
            "DELETE FROM crm_leads",  # cascades to opportunities, activities, quote requests
            "DELETE FROM memberships",
            "DELETE FROM organizations WHERE kind <> 'internal'",
            "DELETE FROM users",
        ):
            await conn.execute(text(statement))
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
