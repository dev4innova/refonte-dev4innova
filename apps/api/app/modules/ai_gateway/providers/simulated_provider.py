"""Offline provider for local development and end-to-end tests (no network, no cost).

Enabled only with AI_ENABLE_SIMULATED_PROVIDER. It answers with a fixed sentence followed
by the last user message, streamed word by word; tokens are counted as words.
"""

import asyncio
from collections.abc import AsyncIterator
from typing import Final

from app.modules.ai_gateway.providers.base import (
    Completed,
    CompletionRequest,
    StreamEvent,
    TextDelta,
    Usage,
)


class SimulatedProvider:
    name: Final = "simulated"

    async def stream(self, request: CompletionRequest) -> AsyncIterator[StreamEvent]:
        last = request.messages[-1].content if request.messages else ""
        words = f"[simulation] {last}".split()
        produced = words[: request.max_tokens]
        for index, word in enumerate(produced):
            await asyncio.sleep(0)
            yield TextDelta(word if index == 0 else f" {word}")
        prompt_words = len(request.system.split()) + sum(
            len(m.content.split()) for m in request.messages
        )
        yield Completed(
            usage=Usage(prompt_words, len(produced)),
            stop_reason="max_tokens" if len(produced) < len(words) else "end",
            served_model=request.model,
        )
