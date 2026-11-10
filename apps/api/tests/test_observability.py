"""Production readiness (EPIC 14): request ids, access logs, safe settings."""

import json
import logging

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.logging import JsonFormatter
from app.core.observability import RequestIdFilter

BASE = {
    "database_url": "postgresql+asyncpg://u:p@localhost/db",
    "redis_url": "redis://localhost:6379/0",
}


async def test_every_response_carries_a_request_id(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="app.access")
    kept = await client.get(
        "/api/v1/content/service", params={"locale": "fr"}, headers={"x-request-id": "abc-12345678"}
    )
    assert kept.headers["x-request-id"] == "abc-12345678"
    assert kept.headers["x-content-type-options"] == "nosniff"
    generated = await client.get("/api/v1/health/live", headers={"x-request-id": "bad id\n"})
    assert (
        generated.headers["x-request-id"] != "bad id\n"
        and len(generated.headers["x-request-id"]) == 32
    )
    # One access line per request, with the id; health checks stay quiet.
    lines = [r for r in caplog.records if r.name == "app.access"]
    assert [(r.http["path"], r.http["status"]) for r in lines] == [("/api/v1/content/service", 200)]  # type: ignore[attr-defined]
    record = lines[0]
    RequestIdFilter().filter(record)
    payload = json.loads(JsonFormatter().format(record))
    assert payload["request_id"] == "abc-12345678"
    assert payload["http"]["method"] == "GET" and payload["http"]["duration_ms"] >= 0


def test_production_refuses_development_settings() -> None:
    with pytest.raises(ValidationError) as error:
        Settings(
            **BASE,
            app_env="production",
            site_url="http://localhost:3000",
            billing_simulated_payments=True,
        )
    message = str(error.value)
    assert "SITE_URL must be https" in message
    assert "simulated AI or payments" in message and "CORS_ALLOWED_ORIGINS" in message
    safe = Settings(
        **BASE,
        app_env="production",
        site_url="https://www.dev4innova.fr",
        cors_allowed_origins=["https://www.dev4innova.fr"],
    )
    assert safe.is_production


def test_the_release_comes_from_railway(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", "abc123")
    assert Settings(**BASE).release == "abc123"


@pytest.mark.parametrize("scheme", ["postgresql", "postgres", "postgresql+asyncpg"])
def test_the_railway_database_url_gets_the_asyncpg_driver(scheme: str) -> None:
    settings = Settings(
        **{**BASE, "database_url": f"{scheme}://u:p@postgres.railway.internal:5432/railway"}
    )
    assert (
        str(settings.database_url)
        == "postgresql+asyncpg://u:p@postgres.railway.internal:5432/railway"
    )


def test_online_payments_need_a_payment_provider() -> None:
    from pydantic import SecretStr

    assert Settings(**BASE).online_payments is False
    assert Settings(**BASE, billing_simulated_payments=True).online_payments is True
    assert Settings(**BASE, stripe_secret_key=SecretStr("sk_test_x")).online_payments is True
