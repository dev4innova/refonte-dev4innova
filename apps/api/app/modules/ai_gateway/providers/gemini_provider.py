"""Gemini adapter (TASK-076), official `google-genai` SDK (async, streaming)."""

from collections.abc import AsyncIterator
from typing import Final

import httpx
from google import genai
from google.genai import errors, types

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

_STOP_REASONS: dict[str, StopReason] = {
    "STOP": "end",
    "MAX_TOKENS": "max_tokens",
    "SAFETY": "refusal",
    "PROHIBITED_CONTENT": "refusal",
    "BLOCKLIST": "refusal",
    "SPII": "refusal",
}


def map_error(error: Exception) -> ProviderError:
    name = "gemini"
    if isinstance(error, errors.APIError):
        code = error.code or 0
        if code in (401, 403):
            return ProviderAuthError("Gemini rejected the credentials", provider=name)
        if code == 429:
            return ProviderRateLimitedError("Gemini rate limit reached", provider=name)
        if 400 <= code < 500:
            return ProviderBadRequestError(f"Gemini refused the request ({code})", provider=name)
        return ProviderUnavailableError("Gemini is unavailable", provider=name)
    if isinstance(error, httpx.TransportError):
        return ProviderUnavailableError("Gemini is unavailable", provider=name)
    return ProviderError("Unexpected Gemini error", provider=name)


class GeminiProvider:
    name: Final = "gemini"

    def __init__(self, client: genai.Client) -> None:
        self._client = client

    async def stream(self, request: CompletionRequest) -> AsyncIterator[StreamEvent]:
        contents = [
            types.Content(
                role="model" if m.role == "assistant" else "user",
                parts=[types.Part(text=m.content)],
            )
            for m in request.messages
        ]
        config = types.GenerateContentConfig(
            system_instruction=request.system or None,
            max_output_tokens=request.max_tokens,
        )
        usage = Usage(0, 0)
        finish = ""
        served = request.model
        try:
            chunks = await self._client.aio.models.generate_content_stream(
                model=request.model, contents=contents, config=config
            )
            async for chunk in chunks:
                served = chunk.model_version or served
                if chunk.usage_metadata:  # cumulative: the last chunk holds the totals
                    usage = Usage(
                        chunk.usage_metadata.prompt_token_count or 0,
                        (chunk.usage_metadata.candidates_token_count or 0)
                        + (chunk.usage_metadata.thoughts_token_count or 0),
                    )
                for candidate in chunk.candidates or []:
                    if candidate.finish_reason:
                        finish = str(candidate.finish_reason.value)
                    for part in (candidate.content.parts if candidate.content else None) or []:
                        if part.text and not part.thought:
                            yield TextDelta(part.text)
        except (errors.APIError, httpx.TransportError) as error:
            raise map_error(error) from error
        yield Completed(
            usage=usage, stop_reason=_STOP_REASONS.get(finish, "other"), served_model=served
        )
