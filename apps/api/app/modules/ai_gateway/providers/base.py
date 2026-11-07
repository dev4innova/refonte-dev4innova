"""Provider contract (TASK-073): the only interface business code depends on.

Each adapter wraps one official SDK (ADR-0007) and normalizes requests, streamed text,
token usage and errors. Nothing outside `app.modules.ai_gateway.providers` imports a
provider SDK.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

ProviderName = Literal["anthropic", "openai", "gemini", "simulated"]
StopReason = Literal["end", "max_tokens", "refusal", "other"]


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True)
class CompletionRequest:
    model: str
    """Provider model identifier, e.g. claude-opus-5-5."""
    messages: list[ChatMessage]
    system: str = ""
    """Instructions, always kept separate from user content (prompt injection defense)."""
    max_tokens: int = 4096
    options: dict[str, Any] = field(default_factory=dict)
    """Provider-specific options from the model registry (effort, fallbacks...)."""


@dataclass(frozen=True)
class Usage:
    input_tokens: int
    output_tokens: int


@dataclass(frozen=True)
class TextDelta:
    text: str


@dataclass(frozen=True)
class Completed:
    """Last event of a stream."""

    usage: Usage
    stop_reason: StopReason
    served_model: str
    """Model that produced the answer (may differ after a provider-side fallback)."""


StreamEvent = TextDelta | Completed


@dataclass(frozen=True)
class Completion:
    text: str
    usage: Usage
    stop_reason: StopReason
    served_model: str


class ProviderError(Exception):
    """Normalized provider failure. `retryable` tells whether trying later may help."""

    code = "provider_error"
    retryable = False

    def __init__(self, message: str, *, provider: str) -> None:
        super().__init__(message)
        self.provider = provider


class ProviderNotConfiguredError(ProviderError):
    code = "provider_not_configured"


class ProviderAuthError(ProviderError):
    code = "provider_auth"


class ProviderBadRequestError(ProviderError):
    code = "provider_bad_request"


class ProviderRateLimitedError(ProviderError):
    code = "provider_rate_limited"
    retryable = True


class ProviderUnavailableError(ProviderError):
    code = "provider_unavailable"
    retryable = True


class AIProvider(Protocol):
    @property
    def name(self) -> ProviderName: ...

    def stream(self, request: CompletionRequest) -> AsyncIterator[StreamEvent]:
        """Text deltas as they are generated, then exactly one `Completed`."""
        ...


async def collect(provider: AIProvider, request: CompletionRequest) -> Completion:
    """Non-streaming completion, built on the stream (one code path per provider)."""
    parts: list[str] = []
    async for event in provider.stream(request):
        if isinstance(event, TextDelta):
            parts.append(event.text)
        else:
            return Completion("".join(parts), event.usage, event.stop_reason, event.served_model)
    raise ProviderUnavailableError("The stream ended without completion", provider=provider.name)
