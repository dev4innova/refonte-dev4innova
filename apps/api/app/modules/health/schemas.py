from typing import Literal

from pydantic import BaseModel

CheckStatus = Literal["ok", "error"]


class LivenessResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class DependencyCheck(BaseModel):
    status: CheckStatus
    latency_ms: float | None = None
    error: str | None = None


class ReadinessResponse(BaseModel):
    status: CheckStatus
    checks: dict[str, DependencyCheck]
