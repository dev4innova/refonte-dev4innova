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
from app.core.storage import ObjectStorage, PrivateStorage, get_private_storage, get_storage
from app.db.session import dispose_engine, get_engine
from app.main import create_app
from app.modules.billing.stripe import SimulatedStripeGateway, get_stripe
from app.modules.identity import auth
from tests.auth_helpers import PASSWORD, bearer, fast_hasher

# Argon2 with production parameters costs ~100 ms per hash: fast parameters keep the suite
# quick. Production parameters are tested in test_auth.py.
auth._hasher = fast_hasher()

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    """Applies the real migrations once: tests run against the production schema."""
    command.upgrade(Config(str(API_ROOT / "alembic.ini")), "head")


TEST_BUCKET = "test-media"
TEST_PORTAL_BUCKET = "test-portal"
TEST_MEDIA_URL = "http://localhost:8000/api/v1/media"


@pytest.fixture
def storage() -> Iterator[ObjectStorage]:
    """In-memory S3 (moto): uploads are real S3 calls, against a fake service."""
    import boto3
    from moto import mock_aws

    with mock_aws():
        client = boto3.client("s3", region_name="eu-west-1")
        for bucket in (TEST_BUCKET, TEST_PORTAL_BUCKET):
            client.create_bucket(
                Bucket=bucket, CreateBucketConfiguration={"LocationConstraint": "eu-west-1"}
            )
        yield ObjectStorage(client, TEST_BUCKET, TEST_MEDIA_URL)


@pytest.fixture
def private_storage(storage: ObjectStorage) -> PrivateStorage:
    """The private portal bucket, in the same in-memory S3 as `storage`."""
    return PrivateStorage(storage._client, TEST_PORTAL_BUCKET)


@pytest.fixture
def stripe() -> SimulatedStripeGateway:
    """Stand-in for Stripe: records Checkout sessions, never calls the network."""
    return SimulatedStripeGateway("http://test")


@pytest.fixture
async def client(
    storage: ObjectStorage, private_storage: PrivateStorage, stripe: SimulatedStripeGateway
) -> AsyncIterator[AsyncClient]:
    get_settings.cache_clear()
    app = create_app()
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_private_storage] = lambda: private_storage
    app.dependency_overrides[get_stripe] = lambda: stripe
    await get_redis().flushdb()  # test database (15): fresh rate limit counters
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    async with get_engine().begin() as conn:
        # Keep what migrations seeded: the internal organization and the services content.
        for statement in (
            "DELETE FROM cms_documents WHERE NOT (type = 'service' AND created_by_id IS NULL)",
            "UPDATE cms_documents SET cover_media_id = NULL",
            "DELETE FROM cms_media",
            "DELETE FROM ai_usage",
            "DELETE FROM ai_quotas",
            "DELETE FROM ai_sessions",  # cascades to ai_messages
            "DELETE FROM diagnostics",
            # Invoices are kept by law (organizations RESTRICT): tests remove them first.
            "DELETE FROM billing_payments",
            "DELETE FROM billing_checkouts",
            "DELETE FROM billing_invoices WHERE credited_invoice_id IS NOT NULL",
            "DELETE FROM billing_invoices",
            "DELETE FROM billing_quotes",
            "DELETE FROM billing_subscriptions",
            "DELETE FROM billing_products",
            "DELETE FROM billing_counters",
            "DELETE FROM billing_stripe_events",
            "DELETE FROM academy_certificates",
            "DELETE FROM academy_courses",  # cascades to modules, lessons, enrollments...
            "DELETE FROM notifications",
            "DELETE FROM portal_projects",  # cascades to tasks, files, deliverables, comments
            "DELETE FROM support_tickets",  # cascades to messages
            "DELETE FROM portal_files",
            # Keep the prompts seeded by migrations (their version 1 says so), at version 1.
            "UPDATE ai_prompts p SET active_version_id = (SELECT v.id FROM ai_prompt_versions v"
            " WHERE v.prompt_id = p.id AND v.version = 1"
            " AND v.notes LIKE 'Initial version (migration%')",
            "DELETE FROM ai_prompt_versions WHERE version > 1 OR prompt_id NOT IN (SELECT prompt_id"
            " FROM ai_prompt_versions WHERE version = 1"
            " AND notes LIKE 'Initial version (migration%')",
            "DELETE FROM ai_prompts WHERE id NOT IN (SELECT prompt_id FROM ai_prompt_versions)",
            # Keep the seeded Claude models, as seeded.
            "DELETE FROM ai_models WHERE provider <> 'anthropic' OR model_id NOT IN"
            " ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')",
            "UPDATE ai_models SET is_enabled = true, is_default = (model_id = 'claude-opus-5-5')",
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
    """A signed-in user: `headers` carry a valid session token."""

    email: str
    headers: dict[str, str]
    id: str = ""
    token: str = ""


@pytest.fixture
def sign_in(client: AsyncClient) -> Callable[[str], Awaitable[Actor]]:
    """Creates an account through the real flow (POST /auth/sign-up), already signed in."""

    async def _sign_in(name: str) -> Actor:
        email = f"{name}@example.com"
        response = await client.post(
            "/api/v1/auth/sign-up",
            json={"email": email, "password": PASSWORD, "display_name": name.capitalize()},
        )
        assert response.status_code == 201, response.text
        body = response.json()
        return Actor(
            email=email, headers=bearer(body["token"]), id=body["user"]["id"], token=body["token"]
        )

    return _sign_in
