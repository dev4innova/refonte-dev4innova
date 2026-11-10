"""Built-in accounts (ADR-0019): sign-up, sign-in, sessions, passwords; profile (TASK-040)."""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

import pytest
from argon2 import PasswordHasher
from httpx import AsyncClient
from sqlalchemy import select, text

from app.db.session import get_engine
from app.modules.identity import auth
from tests.auth_helpers import PASSWORD, bearer
from tests.conftest import Actor

ME = "/api/v1/me"
SIGN_UP = "/api/v1/auth/sign-up"
SIGN_IN = "/api/v1/auth/sign-in"
SIGN_OUT = "/api/v1/auth/sign-out"
SignIn = Callable[[str], Awaitable[Actor]]


async def _sign_in(client: AsyncClient, email: str, password: str = PASSWORD) -> int:
    return (await client.post(SIGN_IN, json={"email": email, "password": password})).status_code


async def test_requires_a_session(client: AsyncClient) -> None:
    response = await client.get(ME)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "unauthorized"
    assert (await client.get(ME, headers=bearer("not-a-session"))).status_code == 401
    assert (await client.get(ME, headers={"Authorization": "Basic abc"})).status_code == 401


async def test_sign_up_creates_the_account_and_signs_in(client: AsyncClient) -> None:
    response = await client.post(
        SIGN_UP,
        json={
            "email": "Alice@Example.com",
            "password": PASSWORD,
            "display_name": "Alice",
            "locale": "en",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["locale"] == "en"
    assert body["user"]["memberships"] == []
    me = await client.get(ME, headers=bearer(body["token"]))
    assert me.json()["id"] == body["user"]["id"]

    # The password is hashed with Argon2id and the token is stored as its SHA-256 only.
    async with get_engine().connect() as conn:
        row = (await conn.execute(text("SELECT password_hash FROM users"))).one()
        stored = (await conn.execute(text("SELECT token_hash FROM auth_sessions"))).scalars()
        assert row.password_hash.startswith("$argon2id$")
        assert PASSWORD not in row.password_hash
        assert list(stored) == [auth.token_hash(body["token"])]


async def test_an_email_has_one_account(client: AsyncClient, sign_in: SignIn) -> None:
    await sign_in("bob")
    response = await client.post(
        SIGN_UP, json={"email": "BOB@example.com", "password": PASSWORD, "display_name": "Bob"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["details"] == {"field": "email"}


@pytest.mark.parametrize(
    ("password", "status"),
    [("short", 422), ("x" * 129, 422), ("carol@example.com", 422)],
)
async def test_weak_passwords_are_refused(client: AsyncClient, password: str, status: int) -> None:
    response = await client.post(
        SIGN_UP, json={"email": "carol@example.com", "password": password, "display_name": "C"}
    )
    assert response.status_code == status


async def test_sign_in_never_says_whether_the_email_exists(
    client: AsyncClient, sign_in: SignIn
) -> None:
    await sign_in("dave")
    wrong_password = await client.post(
        SIGN_IN, json={"email": "dave@example.com", "password": "wrong password!"}
    )
    unknown = await client.post(SIGN_IN, json={"email": "nobody@example.com", "password": PASSWORD})
    assert wrong_password.status_code == unknown.status_code == 401
    assert wrong_password.json() == unknown.json()
    assert await _sign_in(client, "DAVE@example.com") == 200


async def test_sign_in_attempts_are_limited_per_email(
    client: AsyncClient, sign_in: SignIn, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "auth_attempts_per_email", 3)
    await sign_in("erin")
    for _ in range(3):
        assert await _sign_in(client, "erin@example.com", "wrong password!") == 401
    # Locked for this email, even with the right password, for the rest of the window.
    assert await _sign_in(client, "erin@example.com") == 429


async def test_sign_out_revokes_the_session(client: AsyncClient, sign_in: SignIn) -> None:
    actor = await sign_in("frank")
    assert (await client.post(SIGN_OUT, headers=actor.headers)).status_code == 204
    assert (await client.get(ME, headers=actor.headers)).status_code == 401


async def test_expired_sessions_are_refused_and_purged(
    client: AsyncClient, sign_in: SignIn
) -> None:
    from app.db.session import new_session
    from app.modules.identity.models import AuthSession
    from app.modules.identity.service import purge_expired_sessions

    actor = await sign_in("grace")
    async with new_session() as session:
        found = await session.scalar(select(AuthSession))
        assert found is not None
        found.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
    assert (await client.get(ME, headers=actor.headers)).status_code == 401
    async with new_session() as session:
        assert await purge_expired_sessions(session) == 1


async def test_change_password_signs_out_the_other_sessions(
    client: AsyncClient, sign_in: SignIn
) -> None:
    actor = await sign_in("heidi")
    other = await client.post(SIGN_IN, json={"email": actor.email, "password": PASSWORD})
    other_headers = bearer(other.json()["token"])
    new = "another long passphrase"

    wrong = await client.post(
        f"{ME}/password",
        headers=actor.headers,
        json={"current_password": "not it at all", "new_password": new},
    )
    assert wrong.status_code == 422
    assert wrong.json()["error"]["details"] == {"field": "current_password"}
    changed = await client.post(
        f"{ME}/password",
        headers=actor.headers,
        json={"current_password": PASSWORD, "new_password": new},
    )
    assert changed.status_code == 204
    assert (await client.get(ME, headers=actor.headers)).status_code == 200
    assert (await client.get(ME, headers=other_headers)).status_code == 401
    assert await _sign_in(client, actor.email) == 401
    assert await _sign_in(client, actor.email, new) == 200


async def test_staff_admin_resets_a_forgotten_password(
    client: AsyncClient, sign_in: SignIn
) -> None:
    from app.modules.identity.models import INTERNAL_ORGANIZATION_ID

    admin = await sign_in("ivan")
    editor = await sign_in("judy")
    member = await sign_in("ken")
    async with get_engine().begin() as conn:
        for actor, role in ((admin, "staff_admin"), (editor, "staff_editor")):
            await conn.execute(
                text(
                    "INSERT INTO memberships (id, organization_id, user_id, role)"
                    " VALUES (gen_random_uuid(), :org, :user, :role)"
                ),
                {"org": INTERNAL_ORGANIZATION_ID, "user": actor.id, "role": role},
            )
    url = "/api/v1/admin/accounts/password-reset"
    body = {"email": member.email}

    assert (await client.post(url, headers=member.headers, json=body)).status_code == 404
    assert (await client.post(url, headers=editor.headers, json=body)).status_code == 403
    unknown = await client.post(url, headers=admin.headers, json={"email": "x@example.com"})
    assert unknown.status_code == 404

    response = await client.post(url, headers=admin.headers, json=body)
    assert response.status_code == 200
    temporary = response.json()["temporary_password"]
    assert len(temporary) >= auth.PASSWORD_MIN_LENGTH
    assert (await client.get(ME, headers=member.headers)).status_code == 401
    assert await _sign_in(client, member.email) == 401
    assert await _sign_in(client, member.email, temporary) == 200


def test_production_hashes_use_argon2id_with_recommended_costs() -> None:
    hasher = PasswordHasher()
    hashed = hasher.hash(PASSWORD)
    assert hashed.startswith("$argon2id$")
    assert hasher.memory_cost >= 19 * 1024 and hasher.time_cost >= 2
    # A hash made with weaker (older) parameters is upgraded at the next sign-in.
    assert hasher.check_needs_rehash(auth.hash_password(PASSWORD))


def test_password_verification_rejects_everything_else() -> None:
    hashed = auth.hash_password(PASSWORD)
    assert auth.verify_password(hashed, PASSWORD)
    assert not auth.verify_password(hashed, PASSWORD + " ")
    assert not auth.verify_password(None, PASSWORD)
    assert not auth.verify_password("not a hash", PASSWORD)


async def test_updates_the_profile(client: AsyncClient, sign_in: SignIn) -> None:
    actor = await sign_in("leo")
    response = await client.patch(
        ME, headers=actor.headers, json={"display_name": "Leo", "locale": "en"}
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Leo"
    assert response.json()["locale"] == "en"


async def test_rejects_unsupported_locales(client: AsyncClient, sign_in: SignIn) -> None:
    actor = await sign_in("mia")
    assert (await client.patch(ME, headers=actor.headers, json={"locale": "de"})).status_code == 422
