"""Access token verification (TASK-039).

The API trusts nothing but a JWT access token issued by Zitadel (ADR-0009): signature
checked against the issuer's JWKS, plus `iss`, `aud`, `exp`, `nbf` and `sub`.
Sessions, passwords and login screens are the identity provider's job.
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError, UnauthorizedError

ALGORITHMS = ["RS256", "ES256"]

KeyResolver = Callable[[str], Any]
"""Returns the public key for a JWT (given the raw token)."""


@dataclass(frozen=True)
class TokenClaims:
    subject: str
    email: str | None
    name: str | None
    locale: str | None
    raw: dict[str, Any]


class TokenVerifier:
    def __init__(
        self, *, issuer: str, audience: str, resolve_key: KeyResolver, leeway: int = 30
    ) -> None:
        self._issuer = issuer.rstrip("/")
        self._audience = audience
        self._resolve_key = resolve_key
        self._leeway = leeway

    async def verify(self, token: str) -> TokenClaims:
        try:
            # JWKS fetching is blocking (and cached): keep it off the event loop.
            key = await run_in_threadpool(self._resolve_key, token)
            payload: dict[str, Any] = jwt.decode(
                token,
                key=key,
                algorithms=ALGORITHMS,
                issuer=self._issuer,
                audience=self._audience,
                leeway=self._leeway,
                options={"require": ["exp", "iat", "iss", "sub", "aud"]},
            )
        except jwt.PyJWKClientConnectionError as exc:
            raise ServiceUnavailableError("Identity provider keys are unavailable") from exc
        except jwt.PyJWTError as exc:
            # The reason is not returned to the client: it only helps attackers.
            raise UnauthorizedError("Invalid or expired access token") from exc

        return TokenClaims(
            subject=str(payload["sub"]),
            email=_optional_str(payload.get("email")),
            name=_optional_str(payload.get("name")),
            locale=_optional_str(payload.get("locale")),
            raw=payload,
        )


def _optional_str(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


@lru_cache
def get_token_verifier() -> TokenVerifier:
    """FastAPI dependency; tests override it with a verifier using a local key."""
    settings = get_settings()
    if not (settings.auth_issuer and settings.auth_audience and settings.jwks_url):
        raise ServiceUnavailableError("Authentication is not configured")

    jwks = jwt.PyJWKClient(settings.jwks_url, cache_keys=True, lifespan=3600, timeout=5)

    return TokenVerifier(
        issuer=settings.auth_issuer,
        audience=settings.auth_audience,
        resolve_key=lambda token: jwks.get_signing_key_from_jwt(token).key,
        leeway=settings.auth_leeway_seconds,
    )
