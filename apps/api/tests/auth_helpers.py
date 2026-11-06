"""A local stand-in for Zitadel: an RSA key pair that signs test access tokens."""

import time
import uuid
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from app.modules.identity.auth import TokenVerifier

ISSUER = "https://auth.test.dev4innova.local"
AUDIENCE = "test-project-id"

_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def make_verifier() -> TokenVerifier:
    public_key = _PRIVATE_KEY.public_key()
    return TokenVerifier(
        issuer=ISSUER, audience=AUDIENCE, resolve_key=lambda _token: public_key, leeway=0
    )


def make_token(
    subject: str | None = None,
    *,
    email: str | None = None,
    name: str | None = None,
    signed_with_other_key: bool = False,
    **overrides: Any,
) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": ISSUER,
        "aud": [AUDIENCE, "client-id"],
        "sub": subject or str(uuid.uuid4()),
        "iat": now,
        "nbf": now,
        "exp": now + 300,
    }
    if email:
        claims["email"] = email
    if name:
        claims["name"] = name
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    key = _OTHER_KEY if signed_with_other_key else _PRIVATE_KEY
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
