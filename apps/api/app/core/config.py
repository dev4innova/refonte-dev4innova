"""Application settings, loaded from environment variables (see .env.example)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, SecretStr
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
    # Media storage (S3-compatible object storage; MinIO locally). ADR-0010.
    media_s3_bucket: str = "dev4innova-media"
    media_s3_region: str = "fr-par"
    media_s3_endpoint_url: str | None = None
    """Set for MinIO / non-AWS providers, e.g. http://localhost:9000."""
    media_s3_access_key_id: str | None = None
    media_s3_secret_access_key: SecretStr | None = None
    media_public_base_url: str = "http://localhost:9000/dev4innova-media"
    """Public URL prefix of stored media (CDN or public bucket), without trailing slash."""
    media_max_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)

    trust_forwarded_for: bool = False
    """Use X-Forwarded-For for rate limiting. Enable only when the API is reachable
    exclusively through the web app or a trusted reverse proxy."""

    # Identity provider (Zitadel, OIDC). Access tokens must be JWTs (ADR-0009).
    auth_issuer: str | None = None
    """Issuer URL, e.g. https://dev4innova-xxxx.zitadel.cloud (no trailing slash)."""
    auth_audience: str | None = None
    """Expected `aud` claim: the Zitadel project ID."""
    auth_jwks_url: str | None = None
    """Defaults to {auth_issuer}/oauth/v2/keys."""
    auth_userinfo_url: str | None = None
    """Defaults to {auth_issuer}/oidc/v1/userinfo (Zitadel)."""
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

    @property
    def userinfo_url(self) -> str | None:
        if self.auth_userinfo_url:
            return self.auth_userinfo_url
        return f"{self.auth_issuer.rstrip('/')}/oidc/v1/userinfo" if self.auth_issuer else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
