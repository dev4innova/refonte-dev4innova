"""Access token verification (TASK-039) and profile (TASK-040)."""

import time

import pytest
from httpx import AsyncClient

from tests.auth_helpers import bearer, make_token

ME = "/api/v1/me"


async def test_requires_a_token(client: AsyncClient) -> None:
    response = await client.get(ME)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    ("description", "token"),
    [
        ("expired", lambda: make_token(exp=int(time.time()) - 60)),
        ("not yet valid", lambda: make_token(nbf=int(time.time()) + 600)),
        ("wrong issuer", lambda: make_token(iss="https://evil.example.com")),
        ("wrong audience", lambda: make_token(aud="another-project")),
        ("signed with another key", lambda: make_token(signed_with_other_key=True)),
        ("no subject", lambda: make_token(sub=None)),
        ("malformed", lambda: "not-a-jwt"),
    ],
)
async def test_rejects_invalid_tokens(client: AsyncClient, description: str, token: object) -> None:
    response = await client.get(ME, headers=bearer(token()))  # type: ignore[operator]

    assert response.status_code == 401, description
    # The reason is never disclosed.
    assert response.json()["error"]["message"] == "Invalid or expired access token"


async def test_rejects_unsigned_tokens(client: AsyncClient) -> None:
    import jwt

    token = jwt.encode({"sub": "x"}, key=None, algorithm="none")  # type: ignore[arg-type]
    assert (await client.get(ME, headers=bearer(token))).status_code == 401


async def test_first_call_provisions_the_user_from_the_token(client: AsyncClient) -> None:
    token = make_token("sub-alice", email="Alice@Example.com", name="Alice Martin", locale="en-GB")

    response = await client.get(ME, headers=bearer(token))

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["display_name"] == "Alice Martin"
    assert body["locale"] == "en"
    assert body["memberships"] == []

    again = await client.get(ME, headers=bearer(token))
    assert again.json()["id"] == body["id"]


async def test_updates_the_profile(client: AsyncClient) -> None:
    headers = bearer(make_token("sub-bob", email="bob@example.com"))

    response = await client.patch(ME, headers=headers, json={"display_name": "Bob", "locale": "en"})

    assert response.status_code == 200
    assert response.json()["display_name"] == "Bob"
    assert response.json()["locale"] == "en"


async def test_rejects_unsupported_locales(client: AsyncClient) -> None:
    headers = bearer(make_token())
    assert (await client.patch(ME, headers=headers, json={"locale": "de"})).status_code == 422


async def test_auth_not_configured_returns_503() -> None:
    from httpx import ASGITransport

    from app.core.config import get_settings
    from app.main import create_app
    from app.modules.identity.auth import get_token_verifier

    get_settings.cache_clear()
    get_token_verifier.cache_clear()
    app = create_app()  # no override: AUTH_ISSUER / AUTH_AUDIENCE are not set in tests
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(ME, headers=bearer(make_token()))

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
