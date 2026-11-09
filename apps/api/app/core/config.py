"""Application settings, loaded from environment variables (see .env.example)."""

from decimal import Decimal
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
    # Client portal files (EPIC 11): private bucket, same S3 provider and credentials.
    portal_s3_bucket: str = "dev4innova-portal"
    portal_s3_public_endpoint_url: str | None = None
    """S3 endpoint as seen by browsers, used to sign download links (defaults to the
    endpoint above): e.g. http://localhost:9000 when the API reaches MinIO as minio:9000."""
    portal_file_max_bytes: int = Field(default=25 * 1024 * 1024, ge=1024)
    portal_download_ttl_seconds: int = Field(default=300, ge=30, le=3600)
    site_url: str = "http://localhost:3000"
    # Commerce and billing (EPIC 13, ADR-0017)
    stripe_secret_key: SecretStr | None = None
    stripe_webhook_secret: SecretStr | None = None
    stripe_api_base: str = "https://api.stripe.com"
    billing_simulated_payments: bool = False
    """Offline payment pages served by the API (local development, end-to-end tests)."""
    api_public_url: str = "http://localhost:8000"
    """Address of the API seen by browsers (simulated payment pages only)."""
    billing_seller_name: str = "DEV4INNOVA"
    billing_seller_legal_form: str = ""
    billing_seller_address: str = ""
    billing_seller_siren: str = ""
    billing_seller_vat_number: str = ""
    billing_seller_iban: str = ""
    billing_seller_bic: str = ""
    billing_seller_email: str = ""
    billing_payment_terms_days: int = Field(default=30, ge=0, le=60)
    """Public address of the website, printed on certificates for their verification."""

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

    # AI Gateway (ADR-0007, ADR-0012). Provider keys stay in the backend; a provider
    # without a key is reported as not configured.
    anthropic_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    gemini_api_key: SecretStr | None = None
    anthropic_base_url: str | None = None
    openai_base_url: str | None = None
    gemini_base_url: str | None = None
    """Base URLs: only to point the SDKs at simulated providers (tests) or a proxy."""
    ai_request_timeout_seconds: float = Field(default=120.0, gt=0)
    ai_eur_per_usd: Decimal = Field(default=Decimal("0.86"), gt=0)
    """Exchange rate used to convert provider prices (USD) into the EUR budgets."""
    ai_default_monthly_budget_eur: Decimal = Field(default=Decimal("20"), ge=0)
    """Monthly AI budget of an organization without a specific quota."""
    ai_user_requests_per_minute: int = Field(default=20, ge=1)
    ai_session_retention_days: int = Field(default=90, ge=1)
    """Inactive AI sessions (EPIC 09) are purged after this many days."""
    ai_daily_messages_per_user: int = Field(default=200, ge=1)
    ai_document_max_bytes: int = Field(default=10 * 1024 * 1024, ge=1024)
    ai_document_max_chars: int = Field(default=200_000, ge=1_000)
    """Longer documents are refused, never silently truncated."""
    ai_diagnostic_daily_analyses: int = Field(default=300, ge=1)
    """AI analyses of public diagnostics per day, all respondents together (EPIC 10)."""
    ai_enable_simulated_provider: bool = False
    """Offline "simulated" provider (echo) for local development and end-to-end tests."""

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
