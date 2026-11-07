"""Anthropic adapter (TASK-074), official `anthropic` SDK (async, streaming)."""

from collections.abc import AsyncIterator
from typing import Any, Final

import anthropic

from app.modules.ai_gateway.providers.base import (
    Completed,
    CompletionRequest,
    ProviderAuthError,
    ProviderBadRequestError,
    ProviderError,
    ProviderRateLimitedError,
    ProviderUnavailableError,
    StopReason,
    StreamEvent,
    TextDelta,
    Usage,
)

_STOP_REASONS: dict[str | None, StopReason] = {
    "end_turn": "end",
    "stop_sequence": "end",
    "max_tokens": "max_tokens",
    "refusal": "refusal",
}
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def map_error(error: Exception) -> ProviderError:
    """Most specific first: retryable failures must stay distinguishable (429, 5xx, network)."""
    name = "anthropic"
    if isinstance(error, anthropic.AuthenticationError | anthropic.PermissionDeniedError):
        return ProviderAuthError("Anthropic rejected the credentials", provider=name)
    if isinstance(error, anthropic.RateLimitError):
        return ProviderRateLimitedError("Anthropic rate limit reached", provider=name)
    if isinstance(error, anthropic.APIStatusError) and error.status_code < 500:
        return ProviderBadRequestError(
            f"Anthropic refused the request ({error.status_code})", provider=name
        )
    if isinstance(error, anthropic.APIStatusError | anthropic.APIConnectionError):
        return ProviderUnavailableError("Anthropic is unavailable", provider=name)
    return ProviderError("Unexpected Anthropic error", provider=name)


class AnthropicProvider:
    name: Final = "anthropic"

    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        self._client = client

    def _params(self, request: CompletionRequest) -> dict[str, Any]:
        params: dict[str, Any] = {
            "model": request.model,
            "max_tokens": request.max_tokens,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
        }
        if request.system:
            params["system"] = request.system
        effort = request.options.get("effort")
        if effort:
            params["output_config"] = {"effort": effort}
        return params

    async def stream(self, request: CompletionRequest) -> AsyncIterator[StreamEvent]:
        params = self._params(request)
        fallbacks = request.options.get("fallbacks")
        try:
            # Server-side refusal fallback (beta), on the models that support it: a
            # declined request is re-run on another model inside the same call.
            manager = (
                self._client.beta.messages.stream(
                    **params, betas=[FALLBACK_BETA], fallbacks=fallbacks
                )
                if fallbacks
                else self._client.messages.stream(**params)
            )
            async with manager as stream:
                async for event in stream:
                    if event.type == "text":
                        yield TextDelta(event.text)
                message = await stream.get_final_message()
        except anthropic.AnthropicError as error:
            raise map_error(error) from error
        usage = message.usage
        input_tokens = (
            usage.input_tokens
            + (usage.cache_creation_input_tokens or 0)
            + (usage.cache_read_input_tokens or 0)
        )
        yield Completed(
            usage=Usage(input_tokens=input_tokens, output_tokens=usage.output_tokens),
            stop_reason=_STOP_REASONS.get(message.stop_reason, "other"),
            served_model=message.model,
        )
