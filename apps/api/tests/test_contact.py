"""Website contact form endpoint (TASK-055, TASK-057)."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.session import get_engine
from app.modules.contact.models import ContactRequest

URL = "/api/v1/contact-requests"


def payload(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "name": "  Camille Durand ",
        "email": "Camille@Example.com",
        "company": "Acme",
        "topic": "project",
        "message": "Nous souhaitons automatiser le traitement de nos factures fournisseurs.",
        "locale": "fr",
        "consent": True,
    }
    data.update(overrides)
    return data


async def stored() -> list[ContactRequest]:
    from sqlalchemy.ext.asyncio import AsyncSession

    async with AsyncSession(get_engine()) as session:
        return list(await session.scalars(select(ContactRequest)))


async def test_stores_a_valid_request(client: AsyncClient) -> None:
    response = await client.post(URL, json=payload())

    assert response.status_code == 202
    assert response.json()["id"]
    [row] = await stored()
    assert row.name == "Camille Durand"
    assert row.email == "camille@example.com"
    assert row.status == "new"
    assert row.consent_at is not None


async def test_requires_no_authentication(client: AsyncClient) -> None:
    response = await client.post(URL, json=payload(company=None))
    assert response.status_code == 202


@pytest.mark.parametrize(
    "overrides",
    [
        {"consent": False},
        {"consent": None},
        {"email": "not-an-email"},
        {"message": "Trop court"},
        {"name": "A"},
        {"topic": "spam"},
        {"locale": "de"},
        {"message": "x" * 5001},
    ],
)
async def test_rejects_invalid_input(client: AsyncClient, overrides: dict[str, Any]) -> None:
    response = await client.post(URL, json=payload(**overrides))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert await stored() == []


async def test_validation_errors_do_not_echo_the_input(client: AsyncClient) -> None:
    response = await client.post(URL, json=payload(email="secret-value@@x"))
    assert "secret-value" not in response.text


async def test_honeypot_requests_are_accepted_but_discarded(client: AsyncClient) -> None:
    response = await client.post(URL, json=payload(website="http://spam.example.com"))

    assert response.status_code == 202
    assert response.json()["id"] is None
    assert await stored() == []


async def test_rate_limits_per_email(client: AsyncClient) -> None:
    statuses = [(await client.post(URL, json=payload())).status_code for _ in range(4)]

    assert statuses == [202, 202, 202, 429]
    assert len(await stored()) == 3


async def test_rate_limits_per_client(client: AsyncClient) -> None:
    statuses = [
        (await client.post(URL, json=payload(email=f"person{i}@example.com"))).status_code
        for i in range(6)
    ]

    assert statuses[:5] == [202] * 5
    assert statuses[5] == 429
    body = (await client.post(URL, json=payload(email="other@example.com"))).json()
    assert body["error"]["code"] == "rate_limited"
