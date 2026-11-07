"""Simulated AI providers (TASK-082): a local HTTP server that speaks the wire format of
Anthropic, OpenAI and Gemini, so the real SDKs are exercised without network or keys.

The requested model name drives the scenario: "error-401", "error-429", "error-500" answer
with that status, "refuse" ends with the provider's refusal reason, anything else streams
"Bonjour" + " le monde".
"""

import json
import socket
import threading
import time
from collections.abc import AsyncIterator, Iterator
from typing import Any

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.routing import Route

LAST_REQUESTS: dict[str, dict[str, Any]] = {}
TEXT = ["Bonjour", " le monde"]


def _error(model: str) -> Response | None:
    if model.startswith("error-"):
        status = int(model.split("-")[1])
        return JSONResponse(
            {"error": {"type": "error", "message": "simulated"}}, status_code=status
        )
    return None


def _sse(events: list[tuple[str | None, dict[str, Any] | str]]) -> StreamingResponse:
    async def body() -> AsyncIterator[bytes]:
        for name, data in events:
            payload = data if isinstance(data, str) else json.dumps(data)
            prefix = f"event: {name}\n" if name else ""
            yield f"{prefix}data: {payload}\n\n".encode()

    return StreamingResponse(body(), media_type="text/event-stream")


async def anthropic_messages(request: Request) -> Response:
    body = await request.json()
    LAST_REQUESTS["anthropic"] = {"body": body, "headers": dict(request.headers)}
    model = body["model"]
    if error := _error(model):
        return error
    stop = "refusal" if model == "refuse" else "end_turn"
    message = {
        "id": "msg_1",
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [],
        "stop_reason": None,
        "stop_sequence": None,
        "usage": {"input_tokens": 12, "output_tokens": 0},
    }
    events: list[tuple[str | None, dict[str, Any] | str]] = [
        ("message_start", {"type": "message_start", "message": message}),
        (
            "content_block_start",
            {
                "type": "content_block_start",
                "index": 0,
                "content_block": {"type": "text", "text": ""},
            },
        ),
    ]
    for piece in TEXT:
        events.append(
            (
                "content_block_delta",
                {
                    "type": "content_block_delta",
                    "index": 0,
                    "delta": {"type": "text_delta", "text": piece},
                },
            )
        )
    events += [
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        (
            "message_delta",
            {
                "type": "message_delta",
                "delta": {"stop_reason": stop, "stop_sequence": None},
                "usage": {"output_tokens": 5},
            },
        ),
        ("message_stop", {"type": "message_stop"}),
    ]
    return _sse(events)


async def openai_chat(request: Request) -> Response:
    body = await request.json()
    LAST_REQUESTS["openai"] = {"body": body, "headers": dict(request.headers)}
    model = body["model"]
    if error := _error(model):
        return error
    base = {"id": "c1", "object": "chat.completion.chunk", "created": 0, "model": model}
    events: list[tuple[str | None, dict[str, Any] | str]] = []
    for piece in TEXT:
        events.append(
            (
                None,
                {
                    **base,
                    "choices": [{"index": 0, "delta": {"content": piece}, "finish_reason": None}],
                },
            )
        )
    finish = "content_filter" if model == "refuse" else "stop"
    events.append((None, {**base, "choices": [{"index": 0, "delta": {}, "finish_reason": finish}]}))
    events.append(
        (
            None,
            {
                **base,
                "choices": [],
                "usage": {"prompt_tokens": 12, "completion_tokens": 5, "total_tokens": 17},
            },
        )
    )
    events.append((None, "[DONE]"))
    return _sse(events)


async def gemini_stream(request: Request) -> Response:
    body = await request.json()
    model = request.path_params["model"]
    LAST_REQUESTS["gemini"] = {"body": body, "headers": dict(request.headers), "model": model}
    if error := _error(model):
        return error
    events: list[tuple[str | None, dict[str, Any] | str]] = []
    for index, piece in enumerate(TEXT):
        last = index == len(TEXT) - 1
        candidate: dict[str, Any] = {
            "content": {"role": "model", "parts": [{"text": piece}]},
            "index": 0,
        }
        if last:
            candidate["finishReason"] = "SAFETY" if model == "refuse" else "STOP"
        events.append(
            (
                None,
                {
                    "candidates": [candidate],
                    "usageMetadata": {
                        "promptTokenCount": 12,
                        "candidatesTokenCount": 2 + 3 * last,
                        "totalTokenCount": 17,
                    },
                    "modelVersion": model,
                },
            )
        )
    return _sse(events)


app = Starlette(
    routes=[
        Route("/v1/messages", anthropic_messages, methods=["POST"]),
        Route("/v1/chat/completions", openai_chat, methods=["POST"]),
        Route("/v1/models/{model}:streamGenerateContent", gemini_stream, methods=["POST"]),
    ]
)


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def serve() -> Iterator[str]:
    """Starts the simulated providers in a thread; yields their base URL."""
    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.01)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)
