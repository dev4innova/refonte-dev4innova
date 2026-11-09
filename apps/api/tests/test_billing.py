"""Commerce and billing (EPIC 13): catalog, quotes accepted online, gapless invoices, credit
notes, Stripe Checkout and signed webhooks, subscriptions, paid courses, isolation."""

import json
from collections.abc import Awaitable, Callable
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from app.cli import grant_staff
from app.core.config import get_settings
from app.modules.billing.money import euros, line_amounts, share
from app.modules.billing.stripe import (
    InvalidSignatureError,
    SimulatedStripeGateway,
    _form,
    sign,
    verify_signature,
)
from tests.conftest import Actor

SignIn = Callable[[str], Awaitable[Actor]]
ADMIN = "/api/v1/admin/billing"
PROFILE = {
    "legal_name": "Acme SAS",
    "address": "1 rue de la Paix",
    "postal_code": "75002",
    "city": "Paris",
    "email": "compta@acme.example",
    "vat_number": "FR12345678901",
}


def billing(org: str) -> str:
    return f"/api/v1/organizations/{org}/billing"


async def make_staff(sign_in: SignIn, name: str, role: str = "staff_sales") -> Actor:
    actor = await sign_in(name)
    await grant_staff(actor.email, role)
    return actor


async def client_org(
    client: AsyncClient, owner: Actor, slug: str = "acme", member: Actor | None = None
) -> str:
    org: str = (
        await client.post(
            "/api/v1/organizations",
            headers=owner.headers,
            json={"name": slug.title(), "slug": slug},
        )
    ).json()["id"]
    if member:
        await client.post(
            f"/api/v1/organizations/{org}/members",
            headers=owner.headers,
            json={"email": member.email},
        )
    return org


async def quote(
    client: AsyncClient, staff: Actor, org: str, deposit: int = 30, send: bool = True
) -> dict[str, Any]:
    created = await client.post(
        f"{ADMIN}/quotes",
        headers=staff.headers,
        json={
            "organization_id": org,
            "title": "Assistant IA RH",
            "valid_until": str(date.today() + timedelta(days=30)),
            "deposit_percent": deposit,
            "lines": [
                {
                    "description": "Atelier de cadrage",
                    "quantity": "2",
                    "unit_price_cents": 120000,
                    "vat_rate_bp": 2000,
                },
                {
                    "description": "Formation (exonérée)",
                    "quantity": "1",
                    "unit_price_cents": 50000,
                    "vat_rate_bp": 0,
                },
            ],
        },
    )
    assert created.status_code == 201, created.text
    data: dict[str, Any] = created.json()
    if send:
        sent = await client.post(f"{ADMIN}/quotes/{data['id']}/send", headers=staff.headers)
        assert sent.status_code == 200, sent.text
        data = sent.json()
    return data


# --- Units -------------------------------------------------------------------------------


def test_amounts_are_rounded_half_up_per_line() -> None:
    assert line_amounts(Decimal("3"), 3333, 2000).__dict__ == {"net_cents": 9999, "vat_cents": 2000}
    assert line_amounts(Decimal("0.5"), 101, 550).__dict__ == {"net_cents": 51, "vat_cents": 3}
    assert share(290000, 30) == 87000
    assert euros(123456) == "1\u202f234,56 €" and euros(-500) == "-5,00 €"


def test_stripe_parameters_are_form_encoded() -> None:
    encoded = _form(
        {
            "mode": "payment",
            "line_items": [{"price_data": {"unit_amount": 100}, "quantity": 1}],
            "x": None,
            "flag": True,
        }
    )
    assert encoded == [
        ("mode", "payment"),
        ("line_items[0][price_data][unit_amount]", "100"),
        ("line_items[0][quantity]", "1"),
        ("flag", "true"),
    ]


def test_webhook_signatures_are_checked() -> None:
    payload = b'{"id": "evt_1"}'
    assert verify_signature(payload, sign(payload, "whsec"), "whsec")["id"] == "evt_1"
    for header in (None, "t=1,v1=bad", sign(payload, "other"), sign(payload, "whsec", timestamp=1)):
        with pytest.raises(InvalidSignatureError):
            verify_signature(payload, header, "whsec")


# --- Catalog (TASK-110) ------------------------------------------------------------------


async def test_the_catalog_is_managed_by_the_team(client: AsyncClient, sign_in: SignIn) -> None:
    sales = await make_staff(sign_in, "sam")
    editor = await make_staff(sign_in, "ed", role="staff_editor")
    product = {
        "code": "support-m",
        "kind": "subscription",
        "name": {"fr": "Support mensuel", "en": "Monthly support"},
        "unit_price_cents": 49000,
        "interval": "month",
    }
    created = await client.post(f"{ADMIN}/products", headers=sales.headers, json=product)
    assert created.status_code == 201, created.text
    assert (created.json()["code"], created.json()["gross_cents"]) == ("SUPPORT-M", 58800)
    assert (
        await client.post(f"{ADMIN}/products", headers=sales.headers, json=product)
    ).status_code == 409
    assert (
        await client.post(
            f"{ADMIN}/products",
            headers=sales.headers,
            json=product | {"code": "X1", "interval": None},
        )
    ).status_code == 422
    assert (
        await client.post(
            f"{ADMIN}/products",
            headers=sales.headers,
            json=product | {"code": "X2", "name": {"fr": "Seulement FR"}},
        )
    ).status_code == 422
    changed = await client.put(
        f"{ADMIN}/products/{created.json()['id']}",
        headers=sales.headers,
        json=product | {"unit_price_cents": 59000},
    )
    assert changed.json()["unit_price_cents"] == 59000
    assert (
        await client.put(
            f"{ADMIN}/products/{created.json()['id']}",
            headers=sales.headers,
            json=product | {"kind": "service", "interval": None},
        )
    ).status_code == 409
    assert (await client.get(f"{ADMIN}/products", headers=editor.headers)).status_code == 403


# --- Quotes and invoices (TASK-111, TASK-112) --------------------------------------------


async def test_a_quote_is_accepted_online_then_invoiced_in_two_steps(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    owner = await sign_in("olga")
    member = await sign_in("mia")
    org = await client_org(client, owner, member=member)
    draft = await quote(client, sales, org, send=False)
    assert draft["number"].startswith(f"D-{date.today().year}-") and draft["status"] == "draft"
    assert (draft["net_cents"], draft["vat_cents"], draft["gross_cents"]) == (290000, 48000, 338000)
    # Clients never see drafts.
    assert (await client.get(f"{billing(org)}/quotes", headers=owner.headers)).json()["total"] == 0
    sent = (await client.post(f"{ADMIN}/quotes/{draft['id']}/send", headers=sales.headers)).json()
    assert sent["status"] == "sent"
    notes = (await client.get("/api/v1/me/notifications", headers=owner.headers)).json()["items"]
    assert [n["type"] for n in notes] == ["quote_sent"]

    url = f"{billing(org)}/quotes/{sent['id']}"
    # Members do not handle billing; acceptance needs the billing details and the agreement.
    assert (await client.get(url, headers=member.headers)).status_code == 403
    assert (
        await client.post(
            f"{url}/accept", headers=owner.headers, json={"name": "Olga", "agree": False}
        )
    ).status_code == 422
    missing = await client.post(
        f"{url}/accept", headers=owner.headers, json={"name": "Olga Martin", "agree": True}
    )
    assert (missing.status_code, missing.json()["error"]["code"]) == (
        409,
        "billing_profile_required",
    )
    assert (
        await client.put(f"{billing(org)}/profile", headers=owner.headers, json=PROFILE)
    ).status_code == 200
    accepted = await client.post(
        f"{url}/accept", headers=owner.headers, json={"name": "Olga Martin", "agree": True}
    )
    assert accepted.status_code == 200, accepted.text
    deposit = accepted.json()
    assert deposit["number"] == f"F-{date.today().year}-0001" and deposit["purpose"] == "deposit"
    # 30 % of each VAT rate: 2 400 € at 20 %, 500 € at 0 %.
    assert [(line["unit_price_cents"], line["vat_rate_bp"]) for line in deposit["lines"]] == [
        (15000, 0),
        (72000, 2000),
    ]
    assert (deposit["net_cents"], deposit["vat_cents"], deposit["gross_cents"]) == (
        87000,
        14400,
        101400,
    )
    assert (
        deposit["customer"]["legal_name"] == "Acme SAS"
        and deposit["seller"]["name"] == "DEV4INNOVA"
    )
    assert deposit["due_date"] == deposit["issue_date"]
    assert (
        await client.post(
            f"{url}/accept", headers=owner.headers, json={"name": "x y", "agree": True}
        )
    ).status_code == 409
    staff_notes = (await client.get("/api/v1/me/notifications", headers=sales.headers)).json()[
        "items"
    ]
    assert "quote_accepted" in {n["type"] for n in staff_notes}

    # The balance: every line minus the deposit already invoiced.
    balance = await client.post(f"{ADMIN}/quotes/{sent['id']}/balance", headers=sales.headers)
    assert balance.status_code == 200, balance.text
    assert balance.json()["number"] == f"F-{date.today().year}-0002"
    assert balance.json()["gross_cents"] == 338000 - 101400
    assert (
        await client.post(f"{ADMIN}/quotes/{sent['id']}/balance", headers=sales.headers)
    ).status_code == 409
    detail = (await client.get(url, headers=owner.headers)).json()
    assert detail["remaining_to_invoice_cents"] == 0 and len(detail["invoices"]) == 2
    assert detail["acceptance_name"] == "Olga Martin"
    pdf = await client.get(f"{billing(org)}/invoices/{deposit['id']}/pdf", headers=owner.headers)
    assert pdf.content.startswith(b"%PDF") and "F-" in pdf.headers["content-disposition"]
    assert (await client.get(f"{url}/pdf", headers=owner.headers)).content.startswith(b"%PDF")

    # Declining, cancelling, changing what was sent.
    other = await quote(client, sales, org, deposit=0)
    assert (
        await client.put(
            f"{ADMIN}/quotes/{other['id']}",
            headers=sales.headers,
            json={"title": "x", "valid_until": str(date.today()), "lines": []},
        )
    ).status_code == 422
    declined = await client.post(
        f"{billing(org)}/quotes/{other['id']}/decline",
        headers=owner.headers,
        json={"reason": "Budget"},
    )
    assert declined.json()["status"] == "declined"
    assert (
        await client.post(f"{ADMIN}/quotes/{other['id']}/cancel", headers=sales.headers)
    ).status_code == 409


async def test_invoices_are_corrected_by_credit_notes_and_paid_by_transfer(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    owner = await sign_in("olga")
    org = await client_org(client, owner)
    await client.put(f"{billing(org)}/profile", headers=owner.headers, json=PROFILE)
    sent = await quote(client, sales, org, deposit=0)
    invoice = (
        await client.post(
            f"{billing(org)}/quotes/{sent['id']}/accept",
            headers=owner.headers,
            json={"name": "Olga Martin", "agree": True},
        )
    ).json()
    assert invoice["purpose"] == "full" and invoice["due_date"] > invoice["issue_date"]

    url = f"{ADMIN}/invoices/{invoice['id']}"
    assert (
        await client.post(
            f"{url}/transfers",
            headers=sales.headers,
            json={"amount_cents": 999999999, "received_on": str(date.today())},
        )
    ).status_code == 409
    paid = await client.post(
        f"{url}/transfers",
        headers=sales.headers,
        json={"amount_cents": 100000, "received_on": str(date.today()), "reference": "VIR-1"},
    )
    assert (paid.json()["paid_cents"], paid.json()["status"], paid.json()["due_cents"]) == (
        100000,
        "issued",
        238000,
    )
    assert (
        await client.post(
            f"{url}/transfers",
            headers=sales.headers,
            json={"amount_cents": 1000, "received_on": str(date.today()), "reference": "VIR-1"},
        )
    ).status_code == 409
    rest = await client.post(
        f"{url}/transfers",
        headers=sales.headers,
        json={"amount_cents": 238000, "received_on": str(date.today())},
    )
    assert rest.json()["status"] == "paid"
    payments = (await client.get(f"{billing(org)}/payments", headers=owner.headers)).json()
    assert sorted(p["amount_cents"] for p in payments) == [100000, 238000]

    note = await client.post(
        f"{url}/credit-note", headers=sales.headers, json={"reason": "Erreur de quantité"}
    )
    assert note.status_code == 200, note.text
    assert (note.json()["number"], note.json()["kind"]) == (
        f"A-{date.today().year}-0001",
        "credit_note",
    )
    assert (
        note.json()["gross_cents"] == -338000
        and note.json()["credited_invoice_number"] == invoice["number"]
    )
    cancelled = (await client.get(url, headers=sales.headers)).json()
    assert (cancelled["status"], cancelled["credit_note_number"], cancelled["due_cents"]) == (
        "cancelled",
        note.json()["number"],
        0,
    )
    assert (
        await client.post(f"{url}/credit-note", headers=sales.headers, json={"reason": "Encore"})
    ).status_code == 409
    # Numbers never skip: the next invoice follows the last one.
    again = await quote(client, sales, org, deposit=0)
    nxt = (
        await client.post(
            f"{billing(org)}/quotes/{again['id']}/accept",
            headers=owner.headers,
            json={"name": "Olga Martin", "agree": True},
        )
    ).json()
    assert nxt["number"] == f"F-{date.today().year}-0002"


async def test_billing_is_isolated_between_organizations(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    editor = await make_staff(sign_in, "ed", role="staff_editor")
    owner = await sign_in("olga")
    rival = await sign_in("rita")
    org = await client_org(client, owner)
    other = await client_org(client, rival, "globex")
    await client.put(f"{billing(org)}/profile", headers=owner.headers, json=PROFILE)
    sent = await quote(client, sales, org, deposit=0)
    invoice = (
        await client.post(
            f"{billing(org)}/quotes/{sent['id']}/accept",
            headers=owner.headers,
            json={"name": "Olga Martin", "agree": True},
        )
    ).json()
    base = billing(other)
    for method, path, body in [
        ("GET", f"{base}/quotes/{sent['id']}", None),
        ("POST", f"{base}/quotes/{sent['id']}/decline", {}),
        ("GET", f"{base}/invoices/{invoice['id']}", None),
        ("GET", f"{base}/invoices/{invoice['id']}/pdf", None),
        ("POST", f"{base}/invoices/{invoice['id']}/checkout", None),
    ]:
        assert (
            await client.request(method, path, headers=rival.headers, json=body)
        ).status_code == 404, path
    overview = (await client.get(base, headers=rival.headers)).json()
    assert overview["invoices"] == [] and overview["quotes"] == [] and overview["profile"] is None
    assert (await client.get(billing(org), headers=rival.headers)).status_code == 404
    assert (await client.get(f"{ADMIN}/invoices", headers=owner.headers)).status_code == 404
    assert (await client.get(f"{ADMIN}/invoices", headers=editor.headers)).status_code == 403
    # Projects can only be quoted for client organizations.
    internal = "00000000-0000-4000-8000-000000000001"
    assert (
        await client.post(
            f"{ADMIN}/quotes",
            headers=sales.headers,
            json={
                "organization_id": internal,
                "title": "x y",
                "valid_until": str(date.today()),
                "lines": [{"description": "ab", "quantity": "1", "unit_price_cents": 1}],
            },
        )
    ).status_code == 404


# --- Online payment and webhooks (TASK-113, TASK-114, TASK-115) --------------------------


async def test_an_invoice_is_paid_online_and_webhooks_are_signed_and_idempotent(
    client: AsyncClient,
    sign_in: SignIn,
    stripe: SimulatedStripeGateway,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sales = await make_staff(sign_in, "sam")
    owner = await sign_in("olga")
    org = await client_org(client, owner)
    await client.put(f"{billing(org)}/profile", headers=owner.headers, json=PROFILE)
    sent = await quote(client, sales, org)
    deposit = (
        await client.post(
            f"{billing(org)}/quotes/{sent['id']}/accept",
            headers=owner.headers,
            json={"name": "Olga Martin", "agree": True},
        )
    ).json()

    checkout = await client.post(
        f"{billing(org)}/invoices/{deposit['id']}/checkout",
        params={"locale": "fr"},
        headers=owner.headers,
    )
    assert checkout.status_code == 200, checkout.text
    session_id = checkout.json()["url"].rsplit("/", 1)[-1]
    request = stripe.sessions[session_id]
    assert (request.mode, request.item.amount_cents, request.customer_email) == (
        "payment",
        101400,
        "compta@acme.example",
    )
    assert request.customer_id and request.customer_id.startswith("cus_")
    assert request.success_url.endswith(f"/factures/{deposit['id']}?paid=1")

    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    get_settings.cache_clear()
    event = {
        "id": "evt_1",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "payment_status": "paid",
                "amount_total": 101400,
                "payment_intent": "pi_1",
            }
        },
    }
    body = json.dumps(event).encode()
    url = "/api/v1/billing/webhooks/stripe"
    assert (
        await client.post(url, content=body, headers={"stripe-signature": "t=1,v1=nope"})
    ).status_code == 400
    first = await client.post(
        url, content=body, headers={"stripe-signature": sign(body, "whsec_test")}
    )
    assert first.json() == {"processed": True}
    again = await client.post(
        url, content=body, headers={"stripe-signature": sign(body, "whsec_test")}
    )
    assert again.json() == {"processed": False}
    paid = (
        await client.get(f"{billing(org)}/invoices/{deposit['id']}", headers=owner.headers)
    ).json()
    assert (paid["status"], paid["paid_cents"], [p["provider_ref"] for p in paid["payments"]]) == (
        "paid",
        101400,
        ["pi_1"],
    )
    assert (
        await client.post(
            f"{billing(org)}/invoices/{deposit['id']}/checkout", headers=owner.headers
        )
    ).status_code == 409
    staff_notes = (await client.get("/api/v1/me/notifications", headers=sales.headers)).json()[
        "items"
    ]
    assert "payment_received" in {n["type"] for n in staff_notes}
    transactions = (await client.get(f"{ADMIN}/payments", headers=sales.headers)).json()
    assert [(t["provider"], t["amount_cents"]) for t in transactions] == [("stripe", 101400)]
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET")
    get_settings.cache_clear()


async def test_subscriptions_are_invoiced_each_period(
    client: AsyncClient, sign_in: SignIn, stripe: SimulatedStripeGateway
) -> None:
    sales = await make_staff(sign_in, "sam")
    owner = await sign_in("olga")
    org = await client_org(client, owner)
    product = (
        await client.post(
            f"{ADMIN}/products",
            headers=sales.headers,
            json={
                "code": "SUPPORT",
                "kind": "subscription",
                "name": {"fr": "Support", "en": "Support"},
                "unit_price_cents": 10000,
                "interval": "month",
            },
        )
    ).json()
    offers = (await client.get(billing(org), headers=owner.headers)).json()["offers"]
    assert [(o["name"], o["gross_cents"], o["interval"]) for o in offers] == [
        ("Support", 12000, "month")
    ]
    assert (
        await client.post(
            f"{billing(org)}/subscriptions",
            headers=owner.headers,
            json={"product_id": product["id"]},
        )
    ).status_code == 409
    await client.put(f"{billing(org)}/profile", headers=owner.headers, json=PROFILE)
    started = await client.post(
        f"{billing(org)}/subscriptions", headers=owner.headers, json={"product_id": product["id"]}
    )
    session_id = started.json()["url"].rsplit("/", 1)[-1]
    assert stripe.sessions[session_id].mode == "subscription"
    assert stripe.sessions[session_id].item.interval == "month"

    # The simulated Checkout page confirms like Stripe would: subscription, then its first invoice.
    paid = await client.post(f"/api/v1/billing/simulated-checkout/{session_id}")
    assert paid.status_code == 303
    overview = (await client.get(billing(org), headers=owner.headers)).json()
    (subscription,) = overview["subscriptions"]
    assert subscription["status"] == "active" and subscription["current_period_end"]
    (invoice,) = overview["invoices"]
    assert (invoice["purpose"], invoice["status"], invoice["gross_cents"]) == (
        "subscription",
        "paid",
        12000,
    )
    assert (
        await client.post(
            f"{billing(org)}/subscriptions",
            headers=owner.headers,
            json={"product_id": product["id"]},
        )
    ).status_code == 409
    assert (await client.get(f"{ADMIN}/dashboard", headers=sales.headers)).json()[
        "monthly_recurring_cents"
    ] == 12000

    cancelled = await client.post(
        f"{billing(org)}/subscriptions/{subscription['id']}/cancel",
        headers=owner.headers,
        json={"cancel": True},
    )
    assert cancelled.status_code == 204
    assert (await client.get(billing(org), headers=owner.headers)).json()["subscriptions"][0][
        "cancel_at_period_end"
    ] is True


async def test_paid_courses_are_bought_before_enrolling(
    client: AsyncClient, sign_in: SignIn, stripe: SimulatedStripeGateway
) -> None:
    from tests.test_academy import build_course

    editor = await make_staff(sign_in, "ed", role="staff_editor")
    sales = await make_staff(sign_in, "sam")
    course = await build_course(client, editor)
    await client.post(
        f"{ADMIN}/products",
        headers=sales.headers,
        json={
            "code": "COURS-IA",
            "kind": "course",
            "name": {"fr": "Formation IA", "en": "AI course"},
            "unit_price_cents": 15000,
            "course_id": course["id"],
        },
    )
    offer = (await client.get("/api/v1/billing/courses/ia-generative/offer")).json()
    assert (offer["gross_cents"], offer["billing_organizations"]) == (18000, [])
    learner = await sign_in("lea")
    refused = await client.post(
        "/api/v1/academy/courses/ia-generative/enroll", headers=learner.headers
    )
    assert (refused.status_code, refused.json()["error"]["code"]) == (402, "payment_required")

    bought = await client.post(
        "/api/v1/me/billing/courses/ia-generative/checkout",
        headers=learner.headers,
        json={"locale": "en"},
    )
    assert bought.status_code == 200, bought.text
    session_id = bought.json()["url"].rsplit("/", 1)[-1]
    assert stripe.sessions[session_id].success_url.endswith(
        "/en/account/academy/ia-generative?paid=1"
    )
    await client.post(f"/api/v1/billing/simulated-checkout/{session_id}")
    mine = (await client.get("/api/v1/me/academy/courses", headers=learner.headers)).json()
    assert [c["course"]["slug"] for c in mine] == ["ia-generative"]
    # Bought as an individual: a personal billing space holds the paid invoice.
    me = (await client.get("/api/v1/me", headers=learner.headers)).json()
    (personal,) = [m for m in me["memberships"] if m["organization_slug"].startswith("perso-")]
    invoices = (
        await client.get(
            f"{billing(personal['organization_id'])}/invoices", headers=learner.headers
        )
    ).json()["items"]
    assert [(i["purpose"], i["status"], i["gross_cents"]) for i in invoices] == [
        ("course", "paid", 18000)
    ]
    again = await client.post(
        "/api/v1/me/billing/courses/ia-generative/checkout", headers=learner.headers, json={}
    )
    assert again.status_code == 409
