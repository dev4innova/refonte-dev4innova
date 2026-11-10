"""Built-in accounts: password hashing and session tokens (ADR-0019).

- Passwords are hashed with Argon2id (argon2-cffi defaults, RFC 9106 low-memory profile);
  a hash made with older parameters is upgraded at the next successful sign-in.
- A session token is 32 random bytes (URL-safe base64), returned once at sign-in. Only
  its SHA-256 is stored, so the sessions table holds nothing an attacker could replay.
"""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_hasher = PasswordHasher()

PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 128
"""Upper bound against hashing attacks with huge inputs."""

_DUMMY_HASH = _hasher.hash("dev4innova-timing-equalizer")
"""Verified when the email is unknown, so a failed sign-in takes the same time either way."""


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Constant work whether or not the account exists (no user enumeration by timing)."""
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def temporary_password() -> str:
    """Given by the team when someone forgot their password (shown once)."""
    return secrets.token_urlsafe(12)
