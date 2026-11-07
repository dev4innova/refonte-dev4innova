"""Fixed-window rate limiting in Redis (docs/rules/security.md)."""

from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.errors import AppError


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"


async def hit(redis: Redis, *, scope: str, key: str, limit: int, window_seconds: int) -> None:
    """Counts one hit for `key`; raises RateLimitedError above `limit` per window."""
    redis_key = f"d4i:{get_settings().app_env}:ratelimit:{scope}:{key}"
    count = await redis.incr(redis_key)
    if count == 1:
        await redis.expire(redis_key, window_seconds)
    if count > limit:
        raise RateLimitedError(
            "Too many requests, please try again later",
            {"retry_after_seconds": window_seconds},
        )
