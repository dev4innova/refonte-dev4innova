"""Provider contract tests (TASK-073 to TASK-076, TASK-082): every adapter, driven by its
real SDK against simulated providers, honours the same contract."""

from collections.abc import Iterator

import anthropic
import openai
import pytest
from google import genai
from google.genai import types

from app.modules.ai_gateway.providers.anthropic_provider import AnthropicProvider
from app.modules.ai_gateway.providers.base import (
    AIProvider,
    ChatMessage,
    CompletionRequest,
    ProviderAuthError,
    ProviderError,
    ProviderRateLimitedError,
    ProviderUnavailableError,
    TextDelta,
    collect,
)
from app.modules.ai_gateway.providers.gemini_provider import GeminiProvider
from app.modules.ai_gateway.providers.openai_provider import OpenAIProvider
from app.modules.ai_gateway.providers.simulated_provider import SimulatedProvider
from tests import ai_fakes

PROVIDERS = ["anthropic", "openai", "gemini"]


@pytest.fixture(scope="module")
def base_url() -> Iterator[str]:
    yield from ai_fakes.serve()


def make(name: str, base_url: str) -> AIProvider:
    if name == "anthropic":
        return AnthropicProvider(
            anthropic.AsyncAnthropic(api_key="test", base_url=base_url, max_retries=0)
        )
    if name == "openai":
        return OpenAIProvider(
            openai.AsyncOpenAI(api_key="test", base_url=f"{base_url}/v1", max_retries=0)
        )
    options = types.HttpOptions(base_url=base_url, retry_options=types.HttpRetryOptions(attempts=1))
    return GeminiProvider(genai.Client(api_key="test", http_options=options))


def request(model: str = "test-model", **kwargs: object) -> CompletionRequest:
    return CompletionRequest(
        model=model,
        system="Tu es un assistant.",
        messages=[ChatMessage("user", "Dis bonjour")],
        max_tokens=100,
        **kwargs,  # type: ignore[arg-type]
    )


@pytest.mark.parametrize("name", PROVIDERS)
async def test_streams_text_then_usage(name: str, base_url: str) -> None:
    provider = make(name, base_url)
    events = [event async for event in provider.stream(request())]

    assert [e.text for e in events if isinstance(e, TextDelta)] == ["Bonjour", " le monde"]
    final = events[-1]
    assert not isinstance(final, TextDelta)
    assert (final.usage.input_tokens, final.usage.output_tokens) == (12, 5)
    assert final.stop_reason == "end"
    assert final.served_model == "test-model"


@pytest.mark.parametrize("name", PROVIDERS)
async def test_collects_a_completion(name: str, base_url: str) -> None:
    completion = await collect(make(name, base_url), request())
    assert completion.text == "Bonjour le monde"


@pytest.mark.parametrize("name", PROVIDERS)
async def test_reports_refusals(name: str, base_url: str) -> None:
    completion = await collect(make(name, base_url), request("refuse"))
    assert completion.stop_reason == "refusal"


@pytest.mark.parametrize("name", PROVIDERS)
@pytest.mark.parametrize(
    ("model", "error", "retryable"),
    [
        ("error-401", ProviderAuthError, False),
        ("error-429", ProviderRateLimitedError, True),
        ("error-500", ProviderUnavailableError, True),
    ],
)
async def test_normalizes_errors(
    name: str, model: str, error: type[ProviderError], retryable: bool, base_url: str
) -> None:
    with pytest.raises(error) as raised:
        await collect(make(name, base_url), request(model))
    assert raised.value.provider == name
    assert raised.value.retryable is retryable


async def test_unreachable_provider_is_unavailable() -> None:
    provider = make("anthropic", "http://127.0.0.1:9")
    with pytest.raises(ProviderUnavailableError):
        await collect(provider, request())


async def test_instructions_stay_separate_from_user_content(base_url: str) -> None:
    for name in PROVIDERS:
        await collect(make(name, base_url), request())
    sent = ai_fakes.LAST_REQUESTS
    assert sent["anthropic"]["body"]["system"] == "Tu es un assistant."
    assert sent["anthropic"]["body"]["messages"] == [{"role": "user", "content": "Dis bonjour"}]
    assert sent["openai"]["body"]["messages"][0] == {
        "role": "system",
        "content": "Tu es un assistant.",
    }
    assert sent["gemini"]["body"]["systemInstruction"]["parts"] == [{"text": "Tu es un assistant."}]
    assert sent["gemini"]["body"]["contents"] == [
        {"role": "user", "parts": [{"text": "Dis bonjour"}]}
    ]
    assert sent["anthropic"]["body"]["max_tokens"] == 100
    assert sent["openai"]["body"]["max_completion_tokens"] == 100


async def test_anthropic_options_effort_and_fallbacks(base_url: str) -> None:
    provider = make("anthropic", base_url)
    await collect(provider, request(options={"effort": "medium", "fallbacks": "default"}))
    sent = ai_fakes.LAST_REQUESTS["anthropic"]
    assert sent["body"]["output_config"] == {"effort": "medium"}
    assert sent["body"]["fallbacks"] == "default"
    assert "server-side-fallback-2026-07-01" in sent["headers"]["anthropic-beta"]


async def test_simulated_provider_echoes_offline() -> None:
    completion = await collect(SimulatedProvider(), request())
    assert completion.text == "[simulation] Dis bonjour"
    assert (completion.usage.output_tokens, completion.stop_reason) == (3, "end")
