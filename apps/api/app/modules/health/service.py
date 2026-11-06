"""Dependency checks for the readiness probe."""

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.modules.health.schemas import DependencyCheck, ReadinessResponse

logger = logging.getLogger(__name__)


async def _timed_check(
    name: str, probe: Callable[[], Awaitable[object]], timeout_seconds: float
) -> DependencyCheck:
    start = time.perf_counter()
    try:
        await asyncio.wait_for(probe(), timeout=timeout_seconds)
    except Exception as exc:
        # Log details server-side only; never expose connection info to clients.
        logger.warning("Health check failed for %s: %s", name, type(exc).__name__)
        return DependencyCheck(status="error", error=type(exc).__name__)
    return DependencyCheck(status="ok", latency_ms=round((time.perf_counter() - start) * 1000, 2))


async def check_database(engine: AsyncEngine, timeout_seconds: float) -> DependencyCheck:
    async def probe() -> None:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    return await _timed_check("database", probe, timeout_seconds)


async def check_redis(redis: Redis, timeout_seconds: float) -> DependencyCheck:
    async def probe() -> object:
        return await redis.ping()

    return await _timed_check("redis", probe, timeout_seconds)


async def readiness(engine: AsyncEngine, redis: Redis, timeout_seconds: float) -> ReadinessResponse:
    database, cache = await asyncio.gather(
        check_database(engine, timeout_seconds), check_redis(redis, timeout_seconds)
    )
    checks = {"database": database, "redis": cache}
    overall = "ok" if all(c.status == "ok" for c in checks.values()) else "error"
    return ReadinessResponse(status=overall, checks=checks)
