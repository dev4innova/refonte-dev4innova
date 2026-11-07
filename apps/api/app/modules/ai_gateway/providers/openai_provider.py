"""OpenAI adapter (TASK-075), official `openai` SDK (Chat Completions, streaming)."""

from collections.abc import AsyncIterator
from typing import Any, Final, cast

import openai

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
    "stop": "end",
    "length": "max_tokens",
    "content_filter": "refusal",
}


def map_error(error: Exception) -> ProviderError:
    name = "openai"
    if isinstance(error, openai.AuthenticationError | openai.PermissionDeniedError):
        return ProviderAuthError("OpenAI rejected the credentials", provider=name)
    if isinstance(error, openai.RateLimitError):
        return ProviderRateLimitedError("OpenAI rate limit reached", provider=name)
    if isinstance(error, openai.APIStatusError) and error.status_code < 500:
        return ProviderBadRequestError(
            f"OpenAI refused the request ({error.status_code})", provider=name
        )
    if isinstance(error, openai.APIStatusError | openai.APIConnectionError):
        return ProviderUnavailableError("OpenAI is unavailable", provider=name)
    return ProviderError("Unexpected OpenAI error", provider=name)


class OpenAIProvider:
    name: Final = "openai"

    def __init__(self, client: openai.AsyncOpenAI) -> None:
        self._client = client

    async def stream(self, request: CompletionRequest) -> AsyncIterator[StreamEvent]:
        messages: list[dict[str, Any]] = []
        if request.system:
            messages.append({"role": "system", "content": request.system})
        messages += [{"role": m.role, "content": m.content} for m in request.messages]
        effort = request.options.get("reasoning_effort")

        finish: str | None = None
        served = request.model
        usage = Usage(0, 0)
        try:
            chunks = await self._client.chat.completions.create(
                model=request.model,
                messages=cast(Any, messages),
                max_completion_tokens=request.max_tokens,
                stream=True,
                stream_options={"include_usage": True},
                reasoning_effort=effort if effort else openai.omit,
            )
            async for chunk in chunks:
                served = chunk.model or served
                if chunk.usage:  # last chunk, without choices
                    usage = Usage(chunk.usage.prompt_tokens, chunk.usage.completion_tokens)
                for choice in chunk.choices:
                    if choice.delta and choice.delta.content:
                        yield TextDelta(choice.delta.content)
                    if choice.finish_reason:
                        finish = choice.finish_reason
        except openai.OpenAIError as error:
            raise map_error(error) from error
        yield Completed(
            usage=usage, stop_reason=_STOP_REASONS.get(finish, "other"), served_model=served
        )
