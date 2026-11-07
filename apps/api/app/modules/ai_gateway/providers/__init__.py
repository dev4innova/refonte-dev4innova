"""Provider adapters and their factory: the only place that knows the provider SDKs."""

from functools import lru_cache

import anthropic
import openai
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.modules.ai_gateway.providers.anthropic_provider import AnthropicProvider
from app.modules.ai_gateway.providers.base import (
    AIProvider,
    ProviderName,
    ProviderNotConfiguredError,
)
from app.modules.ai_gateway.providers.gemini_provider import GeminiProvider
from app.modules.ai_gateway.providers.openai_provider import OpenAIProvider
from app.modules.ai_gateway.providers.simulated_provider import SimulatedProvider


@lru_cache
def get_provider(name: ProviderName) -> AIProvider:
    """One client per provider and process, built from the backend settings only."""
    settings = get_settings()
    timeout = settings.ai_request_timeout_seconds
    if name == "anthropic" and settings.anthropic_api_key:
        return AnthropicProvider(
            anthropic.AsyncAnthropic(
                api_key=settings.anthropic_api_key.get_secret_value(),
                base_url=settings.anthropic_base_url,
                timeout=timeout,
            )
        )
    if name == "openai" and settings.openai_api_key:
        return OpenAIProvider(
            openai.AsyncOpenAI(
                api_key=settings.openai_api_key.get_secret_value(),
                base_url=settings.openai_base_url,
                timeout=timeout,
            )
        )
    if name == "gemini" and settings.gemini_api_key:
        http_options = types.HttpOptions(
            base_url=settings.gemini_base_url, timeout=int(timeout * 1000)
        )
        return GeminiProvider(
            genai.Client(
                api_key=settings.gemini_api_key.get_secret_value(), http_options=http_options
            )
        )
    if name == "simulated" and settings.ai_enable_simulated_provider:
        return SimulatedProvider()
    raise ProviderNotConfiguredError(f"The {name} provider is not configured", provider=name)


def configured_providers() -> list[ProviderName]:
    settings = get_settings()
    found: list[ProviderName] = []
    if settings.anthropic_api_key:
        found.append("anthropic")
    if settings.openai_api_key:
        found.append("openai")
    if settings.gemini_api_key:
        found.append("gemini")
    if settings.ai_enable_simulated_provider:
        found.append("simulated")
    return found
