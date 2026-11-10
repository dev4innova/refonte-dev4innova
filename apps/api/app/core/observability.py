"""Observability (TASK-117, TASK-118, ADR-0018, ADR-0019): request ids and access logs.

Every request gets an id (taken from a valid X-Request-ID header, else generated), echoed in
the response and attached to every log line. Errors are read in the platform's logs (JSON,
filterable by level and request id): no external error tracker.
"""

import logging
import re
import time
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID: ContextVar[str | None] = ContextVar("request_id", default=None)
_VALID_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
_QUIET_PATHS = ("/api/v1/health/live", "/api/v1/health/ready")

access_log = logging.getLogger("app.access")


class RequestIdFilter(logging.Filter):
    """Adds the current request id to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not getattr(record, "request_id", None):
            record.request_id = REQUEST_ID.get()
        return True


class RequestContextMiddleware:
    """Request id and one access log line per request (method, path, status, duration)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = dict(scope["headers"]).get(b"x-request-id", b"").decode("latin-1")
        request_id = incoming if _VALID_ID.match(incoming) else uuid.uuid4().hex
        token = REQUEST_ID.set(request_id)
        started = time.perf_counter()
        status = 500

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message["headers"] = [
                    *message.get("headers", []),
                    (b"x-request-id", request_id.encode()),
                    (b"x-content-type-options", b"nosniff"),
                ]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            path = scope.get("path", "")
            if path not in _QUIET_PATHS or status >= 400:
                access_log.info(
                    "%s %s %s",
                    scope.get("method"),
                    path,
                    status,
                    extra={
                        "http": {
                            "method": scope.get("method"),
                            "path": path,
                            "status": status,
                            "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                        }
                    },
                )
            REQUEST_ID.reset(token)
