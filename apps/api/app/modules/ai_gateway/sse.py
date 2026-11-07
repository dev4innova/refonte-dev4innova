"""Server-Sent Events encoding of a gateway stream: `delta`, then `done` or `error`."""

import json
from collections.abc import AsyncIterator
from typing import Any

from app.core.errors import AppError
from app.modules.ai_gateway.gateway import Done
from app.modules.ai_gateway.providers.base import TextDelta

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def encode(event: str, data: dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


async def events(
    source: AsyncIterator[TextDelta | Done], *, with_costs: bool
) -> AsyncIterator[bytes]:
    """`with_costs`: tokens, cost and model for staff; end reason only for clients."""
    try:
        async for event in source:
            if isinstance(event, TextDelta):
                yield encode("delta", {"text": event.text})
            elif with_costs:
                yield encode(
                    "done",
                    {
                        "input_tokens": event.input_tokens,
                        "output_tokens": event.output_tokens,
                        "cost_eur": str(event.cost_eur),
                        "stop_reason": event.stop_reason,
                        "served_model": event.served_model,
                        "latency_ms": event.latency_ms,
                    },
                )
            else:
                yield encode("done", {"stop_reason": event.stop_reason})
    except AppError as error:
        # Headers are already sent: the error travels as the last event.
        yield encode("error", {"code": error.code, "message": error.message})
