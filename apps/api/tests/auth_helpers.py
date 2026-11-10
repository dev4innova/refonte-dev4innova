"""Helpers for built-in accounts in tests (ADR-0019)."""

from argon2 import PasswordHasher

PASSWORD = "correct horse battery staple"  # noqa: S105 (test fixture, not a secret)
"""Password of every account created by the `sign_in` fixture."""


def fast_hasher() -> PasswordHasher:
    """Argon2id with minimal costs: tests only, never production."""
    return PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
