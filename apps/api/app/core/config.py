"""Application settings, loaded from environment variables (see .env.example)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["local", "test", "staging", "production"] = "local"
    app_name: str = "dev4innova-api"
    app_version: str = "0.1.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # No default: secrets and connection strings must come from the environment.
    database_url: PostgresDsn
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=10, ge=0)
    redis_url: RedisDsn

    cors_allowed_origins: list[str] = ["http://localhost:3000"]

    # Identity provider (Zitadel, OIDC). Access tokens must be JWTs (ADR-0009).
    auth_issuer: str | None = None
    """Issuer URL, e.g. https://dev4innova-xxxx.zitadel.cloud (no trailing slash)."""
    auth_audience: str | None = None
    """Expected `aud` claim: the Zitadel project ID."""
    auth_jwks_url: str | None = None
    """Defaults to {auth_issuer}/oauth/v2/keys."""
    auth_leeway_seconds: int = Field(default=30, ge=0, le=300)
    health_check_timeout_seconds: float = Field(default=2.0, gt=0)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def jwks_url(self) -> str | None:
        if self.auth_jwks_url:
            return self.auth_jwks_url
        return f"{self.auth_issuer.rstrip('/')}/oauth/v2/keys" if self.auth_issuer else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
