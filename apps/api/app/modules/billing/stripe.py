"""Stripe, through its HTTP API (ADR-0017): hosted Checkout pages only (no card data ever
reaches us, PCI DSS SAQ A), subscriptions managed by Stripe, signed webhooks.

The gateway is a FastAPI dependency: tests use a fake one; local development and end-to-end
tests can use the "simulated" gateway (BILLING_SIMULATED_PAYMENTS, never in production).
"""

import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import AppError, ServiceUnavailableError

SIGNATURE_TOLERANCE_SECONDS = 300


class InvalidSignatureError(AppError):
    status_code = 400
    code = "invalid_signature"


@dataclass(frozen=True)
class CheckoutItem:
    name: str
    amount_cents: int
    """Amount including VAT: what the customer pays."""
    interval: str | None = None


@dataclass(frozen=True)
class CheckoutRequest:
    mode: str
    """payment or subscription."""
    item: CheckoutItem
    customer_id: str | None
    customer_email: str
    success_url: str
    cancel_url: str
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class CheckoutSession:
    id: str
    url: str


class StripeGateway(Protocol):
    async def create_customer(self, *, name: str, email: str, metadata: dict[str, str]) -> str: ...

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession: ...

    async def cancel_at_period_end(self, subscription_id: str, cancel: bool) -> None: ...


def _form(data: dict[str, Any], prefix: str = "") -> list[tuple[str, str]]:
    """Stripe's form encoding of nested parameters (a[b][0][c]=...)."""
    items: list[tuple[str, str]] = []
    for key, value in data.items():
        name = f"{prefix}[{key}]" if prefix else key
        if isinstance(value, dict):
            items += _form(value, name)
        elif isinstance(value, list):
            for index, element in enumerate(value):
                items += (
                    _form(element, f"{name}[{index}]")
                    if isinstance(element, dict)
                    else [(f"{name}[{index}]", str(element))]
                )
        elif value is not None:
            items.append(
                (name, "true" if value is True else "false" if value is False else str(value))
            )
    return items


class HttpStripeGateway:
    def __init__(self, secret_key: str, api_base: str, timeout: float = 20) -> None:
        self._client = httpx.AsyncClient(
            base_url=api_base.rstrip("/"),
            auth=(secret_key, ""),
            timeout=timeout,
            headers={"Stripe-Version": "2025-10-29.clover"},
        )

    async def _post(
        self, path: str, data: dict[str, Any], idempotency_key: str | None = None
    ) -> dict[str, Any]:
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else {}
        try:
            response = await self._client.post(path, data=_form(data), headers=headers)  # type: ignore[arg-type]
        except httpx.HTTPError as error:
            raise ServiceUnavailableError("The payment provider is unreachable") from error
        if response.status_code >= 400:
            raise ServiceUnavailableError(
                "The payment provider refused the request", {"status": response.status_code}
            )
        result: dict[str, Any] = response.json()
        return result

    async def create_customer(self, *, name: str, email: str, metadata: dict[str, str]) -> str:
        data = await self._post(
            "/v1/customers", {"name": name, "email": email, "metadata": metadata}
        )
        return str(data["id"])

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        price: dict[str, Any] = {
            "currency": "eur",
            "unit_amount": request.item.amount_cents,
            "product_data": {"name": request.item.name},
        }
        if request.item.interval:
            price["recurring"] = {"interval": request.item.interval}
        data: dict[str, Any] = {
            "mode": request.mode,
            "line_items": [{"price_data": price, "quantity": 1}],
            "success_url": request.success_url,
            "cancel_url": request.cancel_url,
            "metadata": request.metadata,
            "payment_method_types": ["card", "sepa_debit"],
            "locale": "auto",
        }
        if request.customer_id:
            data["customer"] = request.customer_id
        else:
            data["customer_email"] = request.customer_email
        if request.mode == "subscription":
            data["subscription_data"] = {"metadata": request.metadata}
        else:
            data["payment_intent_data"] = {"metadata": request.metadata}
        session = await self._post("/v1/checkout/sessions", data, idempotency_key=str(uuid.uuid4()))
        return CheckoutSession(id=str(session["id"]), url=str(session["url"]))

    async def cancel_at_period_end(self, subscription_id: str, cancel: bool) -> None:
        await self._post(f"/v1/subscriptions/{subscription_id}", {"cancel_at_period_end": cancel})


class SimulatedStripeGateway:
    """Offline stand-in for local development and end-to-end tests: Checkout pages are served
    by the API itself (/billing/simulated-checkout/{id}) and confirm the payment on click."""

    def __init__(self, api_url: str) -> None:
        self._api_url = api_url.rstrip("/")
        self.sessions: dict[str, CheckoutRequest] = {}

    async def create_customer(self, *, name: str, email: str, metadata: dict[str, str]) -> str:
        return f"cus_sim_{uuid.uuid4().hex[:14]}"

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        session_id = f"cs_sim_{uuid.uuid4().hex}"
        self.sessions[session_id] = request
        return CheckoutSession(
            id=session_id, url=f"{self._api_url}/api/v1/billing/simulated-checkout/{session_id}"
        )

    async def cancel_at_period_end(self, subscription_id: str, cancel: bool) -> None:
        return None


class UnconfiguredStripeGateway:
    async def _fail(self) -> Any:
        raise ServiceUnavailableError(
            "Online payment is not configured", {"reason": "not_configured"}
        )

    async def create_customer(self, *, name: str, email: str, metadata: dict[str, str]) -> str:
        return str(await self._fail())

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        return await self._fail()  # type: ignore[no-any-return]

    async def cancel_at_period_end(self, subscription_id: str, cancel: bool) -> None:
        await self._fail()


@lru_cache
def get_stripe() -> StripeGateway:
    settings = get_settings()
    if settings.billing_simulated_payments and not settings.is_production:
        return SimulatedStripeGateway(settings.api_public_url)
    if settings.stripe_secret_key is None:
        return UnconfiguredStripeGateway()
    return HttpStripeGateway(
        settings.stripe_secret_key.get_secret_value(), settings.stripe_api_base
    )


def verify_signature(
    payload: bytes, header: str | None, secret: str, now: float | None = None
) -> dict[str, Any]:
    """Checks the Stripe-Signature header (HMAC-SHA256 of "timestamp.payload", 5 minutes)."""
    if not header:
        raise InvalidSignatureError("Missing signature")
    parts: dict[str, list[str]] = {}
    for item in header.split(","):
        key, _, value = item.partition("=")
        parts.setdefault(key.strip(), []).append(value.strip())
    try:
        timestamp = int(parts["t"][0])
    except (KeyError, ValueError) as error:
        raise InvalidSignatureError("Malformed signature") from error
    if abs((now or time.time()) - timestamp) > SIGNATURE_TOLERANCE_SECONDS:
        raise InvalidSignatureError("Expired signature")
    expected = hmac.new(
        secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, candidate) for candidate in parts.get("v1", [])):
        raise InvalidSignatureError("Invalid signature")
    try:
        event: dict[str, Any] = json.loads(payload)
    except json.JSONDecodeError as error:
        raise InvalidSignatureError("Invalid payload") from error
    return event


def sign(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    """Stripe-Signature header for a payload (tests and the simulated gateway)."""
    timestamp = timestamp or int(time.time())
    digest = hmac.new(
        secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={digest}"
