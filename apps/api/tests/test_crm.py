"""CRM (EPIC 07): staff access and isolation, prospects from the website forms, manual
prospects, activities, assignment, pipeline, quote requests, dashboard and GDPR erasure."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from httpx import AsyncClient
from sqlalchemy import text

from app.cli import grant_staff
from app.db.session import get_engine
from tests.conftest import Actor

ADMIN = "/api/v1/admin/crm"
CONTACT = "/api/v1/contact-requests"
QUOTE = "/api/v1/quote-requests"
SignIn = Callable[[str], Awaitable[Actor]]


async def make_staff(sign_in: SignIn, name: str, role: str = "staff_sales") -> Actor:
    actor = await sign_in(name)
    await grant_staff(actor.email, role)
    return actor


def contact(**overrides: Any) -> dict[str, Any]:
    data = {
        "name": "Camille Durand",
        "email": "Camille@Example.com",
        "company": "Acme",
        "topic": "project",
        "message": "Nous souhaitons automatiser le traitement de nos factures.",
        "locale": "fr",
        "consent": True,
    }
    data.update(overrides)
    return data


def quote(**overrides: Any) -> dict[str, Any]:
    data = {
        "name": "Dominique Martin",
        "email": "dominique@example.com",
        "company": "Globex",
        "service": "custom-development",
        "need": "Un assistant pour répondre aux questions de nos clients sur leurs contrats.",
        "budget": "30k_100k",
        "timeline": "within_3_months",
        "locale": "fr",
        "consent": True,
    }
    data.update(overrides)
    return data


async def create_lead(client: AsyncClient, staff: Actor, **body: Any) -> dict[str, Any]:
    payload = {"email": "lead@example.com", "name": "Lead Person", **body}
    response = await client.post(f"{ADMIN}/leads", headers=staff.headers, json=payload)
    assert response.status_code == 201, response.text
    return dict(response.json())


async def leads(client: AsyncClient, staff: Actor, query: str = "") -> list[dict[str, Any]]:
    response = await client.get(f"{ADMIN}/leads{query}", headers=staff.headers)
    assert response.status_code == 200, response.text
    return list(response.json()["items"])


# --- Access and isolation ------------------------------------------------------------


async def test_only_sales_staff_reach_the_crm(client: AsyncClient, sign_in: SignIn) -> None:
    visitor = await sign_in("visitor")
    # Owner of a client organization: still not staff.
    await client.post(
        "/api/v1/organizations", headers=visitor.headers, json={"name": "Acme", "slug": "acme"}
    )
    editor = await make_staff(sign_in, "eve", "staff_editor")
    sales = await make_staff(sign_in, "sam")

    assert (await client.get(f"{ADMIN}/leads")).status_code == 401
    for url in ("/leads", "/opportunities", "/quote-requests", "/dashboard", "/inbox", "/team"):
        assert (await client.get(ADMIN + url, headers=visitor.headers)).status_code == 404, url
        assert (await client.get(ADMIN + url, headers=editor.headers)).status_code == 403, url
        assert (await client.get(ADMIN + url, headers=sales.headers)).status_code == 200, url


async def test_prospects_of_another_organization_are_invisible(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    owner = await sign_in("olga")
    org = await client.post(
        "/api/v1/organizations", headers=owner.headers, json={"name": "Other", "slug": "other"}
    )
    other_org = org.json()["id"]
    foreign_id = uuid.uuid4()
    async with get_engine().begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO crm_leads (id, organization_id, email, name, source, status,"
                " last_activity_at) VALUES (:id, :org, 'x@example.com', 'X', 'manual', 'new',"
                " now())"
            ),
            {"id": foreign_id, "org": other_org},
        )
    own = await create_lead(client, sales)

    assert [lead["id"] for lead in await leads(client, sales)] == [own["id"]]
    for method, url, body in [
        ("GET", f"/leads/{foreign_id}", None),
        ("PATCH", f"/leads/{foreign_id}", {"status": "contacted"}),
        ("POST", f"/leads/{foreign_id}/activities", {"type": "note", "body": "x"}),
        ("PUT", f"/leads/{foreign_id}/owner", {"owner_id": None}),
        ("POST", "/opportunities", {"lead_id": str(foreign_id), "title": "Stolen"}),
    ]:
        response = await client.request(method, ADMIN + url, headers=sales.headers, json=body)
        assert response.status_code == 404, f"{method} {url}"
    dashboard = (await client.get(f"{ADMIN}/dashboard", headers=sales.headers)).json()
    assert dashboard["leads_by_status"]["new"] == 1


# --- Website forms (TASK-067, TASK-072) ----------------------------------------------


async def test_contact_messages_create_one_prospect_per_address(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    assert (await client.post(CONTACT, json=contact())).status_code == 202
    second = contact(email="camille@example.com", name="Camille D.", company=None, topic="training")
    assert (await client.post(CONTACT, json=second)).status_code == 202

    [lead] = await leads(client, sales)
    assert lead["email"] == "camille@example.com"
    assert lead["name"] == "Camille D."
    assert lead["company"] == "Acme"  # an empty field never erases a known one
    assert (lead["source"], lead["status"], lead["owner"]) == ("contact_form", "new", None)

    detail = (await client.get(f"{ADMIN}/leads/{lead['id']}", headers=sales.headers)).json()
    messages = [a for a in detail["activities"] if a["type"] == "contact_message"]
    assert [m["details"]["topic"] for m in messages] == ["training", "project"]
    assert all(m["author"] is None and m["details"]["contact_request_id"] for m in messages)


async def test_a_prospect_set_aside_comes_back_when_writing_again(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    await client.post(CONTACT, json=contact())
    [lead] = await leads(client, sales)
    await client.patch(
        f"{ADMIN}/leads/{lead['id']}", headers=sales.headers, json={"status": "unqualified"}
    )
    await client.post(CONTACT, json=contact())
    assert (await leads(client, sales))[0]["status"] == "new"


async def test_a_quote_request_opens_an_opportunity(client: AsyncClient, sign_in: SignIn) -> None:
    sales = await make_staff(sign_in, "sam")
    response = await client.post(QUOTE, json=quote())
    assert response.status_code == 202
    assert response.json()["id"]

    [lead] = await leads(client, sales)
    assert lead["source"] == "quote_request"
    [request] = (await client.get(f"{ADMIN}/quote-requests", headers=sales.headers)).json()
    assert (request["service"], request["budget"], request["status"]) == (
        "custom-development",
        "30k_100k",
        "new",
    )
    [opportunity] = (await client.get(f"{ADMIN}/opportunities", headers=sales.headers)).json()
    assert (opportunity["title"], opportunity["stage"]) == ("Globex", "qualification")
    assert request["opportunity_id"] == opportunity["id"]

    answered = await client.patch(
        f"{ADMIN}/quote-requests/{request['id']}",
        headers=sales.headers,
        json={"status": "answered"},
    )
    assert answered.json()["status"] == "answered"


async def test_quote_requests_are_validated_and_filtered(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    for overrides in (
        {"consent": False},
        {"need": "Trop court"},
        {"budget": "a lot"},
        {"service": "../admin"},
        {"email": "nope"},
    ):
        assert (await client.post(QUOTE, json=quote(**overrides))).status_code == 422, overrides

    # Honeypot: looks like a success, stores nothing.
    bot = await client.post(QUOTE, json=quote(website="https://spam.example"))
    assert (bot.status_code, bot.json()["id"]) == (202, None)
    assert await leads(client, sales) == []


async def test_quote_requests_are_rate_limited_per_address(client: AsyncClient) -> None:
    codes = [(await client.post(QUOTE, json=quote())).status_code for _ in range(4)]
    assert codes == [202, 202, 202, 429]


# --- Prospects, activities and assignment (TASK-067, TASK-068, TASK-070) --------------


async def test_manual_prospects_are_unique_per_address(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    lead = await create_lead(client, sales, email="Lead@Example.com", company="  Initech ")
    assert (lead["email"], lead["company"], lead["source"]) == (
        "lead@example.com",
        "Initech",
        "manual",
    )
    assert lead["owner"]["id"] == sales.id  # the creator owns it

    duplicate = await client.post(
        f"{ADMIN}/leads", headers=sales.headers, json={"email": "lead@example.com", "name": "Xy"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["details"]["lead_id"] == lead["id"]


async def test_search_and_filters(client: AsyncClient, sign_in: SignIn) -> None:
    sales = await make_staff(sign_in, "sam")
    mine = await create_lead(client, sales, email="ana@example.com", name="Ana", company="100% IA")
    await client.post(CONTACT, json=contact())  # unassigned

    assert [lead["name"] for lead in await leads(client, sales, "?q=100%")] == ["Ana"]
    assert await leads(client, sales, "?q=%25") != []  # literal %, not a wildcard
    assert await leads(client, sales, "?q=_") == []
    assert [x["id"] for x in await leads(client, sales, "?owner=me")] == [mine["id"]]
    assert [x["name"] for x in await leads(client, sales, "?owner=unassigned")] == [
        "Camille Durand"
    ]
    page = (await client.get(f"{ADMIN}/leads?page_size=1&page=2", headers=sales.headers)).json()
    assert (page["total"], len(page["items"])) == (2, 1)


async def test_activities_and_status_changes_build_the_timeline(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    lead = await create_lead(client, sales)
    url = f"{ADMIN}/leads/{lead['id']}"

    call = await client.post(
        f"{url}/activities",
        headers=sales.headers,
        json={"type": "call", "body": "Premier échange", "occurred_at": "2026-11-01T10:00:00Z"},
    )
    assert call.status_code == 201
    await client.patch(url, headers=sales.headers, json={"status": "contacted", "phone": "0102"})
    refused = await client.post(
        f"{url}/activities", headers=sales.headers, json={"type": "stage_change", "body": "x"}
    )
    assert refused.status_code == 422  # automatic types cannot be logged by hand

    detail = (await client.get(url, headers=sales.headers)).json()
    assert (detail["status"], detail["phone"]) == ("contacted", "0102")
    assert [(a["type"], a["author"]["id"]) for a in detail["activities"]] == [
        ("status_change", sales.id),
        ("call", sales.id),
    ]
    assert detail["activities"][0]["details"] == {"from": "new", "to": "contacted"}


async def test_assignment_is_limited_to_sales_staff(client: AsyncClient, sign_in: SignIn) -> None:
    sales = await make_staff(sign_in, "sam")
    colleague = await make_staff(sign_in, "carl")
    editor = await make_staff(sign_in, "eve", "staff_editor")
    outsider = await sign_in("olga")
    await client.post(CONTACT, json=contact())
    [lead] = await leads(client, sales)
    url = f"{ADMIN}/leads/{lead['id']}/owner"

    team = (await client.get(f"{ADMIN}/team", headers=sales.headers)).json()
    assert {p["id"] for p in team} == {sales.id, colleague.id}
    for person in (editor, outsider):
        response = await client.put(url, headers=sales.headers, json={"owner_id": person.id})
        assert response.status_code == 422

    assigned = await client.put(url, headers=sales.headers, json={"owner_id": colleague.id})
    assert assigned.json()["owner"]["id"] == colleague.id
    assert assigned.json()["activities"][0]["details"] == {"from": None, "to": colleague.id}
    unassigned = await client.put(url, headers=sales.headers, json={"owner_id": None})
    assert unassigned.json()["owner"] is None


# --- Pipeline (TASK-069) -------------------------------------------------------------


async def test_opportunities_move_through_the_pipeline(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    lead = await create_lead(client, sales)
    created = await client.post(
        f"{ADMIN}/opportunities",
        headers=sales.headers,
        json={"lead_id": lead["id"], "title": "Assistant IA", "amount": "12000.50"},
    )
    assert created.status_code == 201
    opportunity = created.json()
    assert (opportunity["stage"], opportunity["amount"], opportunity["currency"]) == (
        "qualification",
        "12000.50",
        "EUR",
    )
    url = f"{ADMIN}/opportunities/{opportunity['id']}"

    proposal = (await client.patch(url, headers=sales.headers, json={"stage": "proposal"})).json()
    assert proposal["closed_at"] is None
    won = (await client.patch(url, headers=sales.headers, json={"stage": "won"})).json()
    assert won["closed_at"] and won["lead"]["status"] == "customer"
    reopened = await client.patch(url, headers=sales.headers, json={"stage": "negotiation"})
    assert reopened.json()["closed_at"] is None
    cleared = await client.patch(url, headers=sales.headers, json={"clear_amount": True})
    assert cleared.json()["amount"] is None

    detail = (await client.get(f"{ADMIN}/leads/{lead['id']}", headers=sales.headers)).json()
    moves = [a["details"]["to"] for a in detail["activities"] if a["type"] == "stage_change"]
    assert moves == ["negotiation", "won", "proposal"]


async def test_the_pipeline_hides_opportunities_closed_long_ago(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    lead = await create_lead(client, sales)
    for title, stage in (("Open", "qualification"), ("Recent", "lost"), ("Old", "won")):
        await client.post(
            f"{ADMIN}/opportunities",
            headers=sales.headers,
            json={"lead_id": lead["id"], "title": title, "stage": stage},
        )
    async with get_engine().begin() as conn:
        await conn.execute(
            text(
                "UPDATE crm_opportunities SET closed_at = now() - interval '60 days'"
                " WHERE title = 'Old'"
            )
        )

    pipeline = (await client.get(f"{ADMIN}/opportunities", headers=sales.headers)).json()
    assert {o["title"] for o in pipeline} == {"Open", "Recent"}
    wide = await client.get(f"{ADMIN}/opportunities?closed_within_days=90", headers=sales.headers)
    assert {o["title"] for o in wide.json()} == {"Open", "Recent", "Old"}


async def test_activities_only_link_the_prospects_own_opportunities(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await make_staff(sign_in, "sam")
    first = await create_lead(client, sales, email="a@example.com")
    second = await create_lead(client, sales, email="b@example.com")
    other = await client.post(
        f"{ADMIN}/opportunities",
        headers=sales.headers,
        json={"lead_id": second["id"], "title": "Second"},
    )
    response = await client.post(
        f"{ADMIN}/leads/{first['id']}/activities",
        headers=sales.headers,
        json={"type": "note", "body": "x", "opportunity_id": other.json()["id"]},
    )
    assert response.status_code == 422


# --- Dashboard (TASK-071) ------------------------------------------------------------


async def test_dashboard_figures(client: AsyncClient, sign_in: SignIn) -> None:
    sales = await make_staff(sign_in, "sam")
    lead = await create_lead(client, sales)
    await client.post(CONTACT, json=contact())
    await client.post(QUOTE, json=quote())
    for title, stage, amount in (
        ("Deal A", "proposal", "1000"),
        ("Deal B", "proposal", "500.25"),
        ("Deal C", "won", "2000"),
        ("Deal D", "lost", None),
    ):
        created = await client.post(
            f"{ADMIN}/opportunities",
            headers=sales.headers,
            json={"lead_id": lead["id"], "title": title, "stage": stage, "amount": amount},
        )
        assert created.status_code == 201, created.text

    data = (await client.get(f"{ADMIN}/dashboard", headers=sales.headers)).json()
    assert data["leads_by_status"] == {
        "new": 2,
        "contacted": 0,
        "qualified": 0,
        "customer": 1,  # won opportunity
        "unqualified": 0,
    }
    assert data["new_leads_30_days"] == 3
    assert data["leads_by_source_30_days"] == {"manual": 1, "contact_form": 1, "quote_request": 1}
    assert (data["unassigned_open_leads"], data["my_open_leads"]) == (2, 0)
    assert data["new_quote_requests"] == 1
    stages = {s["stage"]: (s["count"], s["amount"]) for s in data["pipeline"]}
    assert stages == {
        "qualification": (1, "0"),  # the quote request
        "proposal": (2, "1500.25"),
        "negotiation": (0, "0"),
    }
    assert data["open_pipeline_amount"] == "1500.25"
    assert (data["won_90_days"]["count"], data["won_90_days"]["amount"]) == (1, "2000.00")
    assert (data["lost_90_days"], data["win_rate_90_days"]) == (1, 0.5)

    inbox = (await client.get(f"{ADMIN}/inbox", headers=sales.headers)).json()
    assert inbox == {"new_leads": 2, "new_quote_requests": 1}


# --- GDPR erasure --------------------------------------------------------------------


async def test_only_staff_admins_erase_prospects(client: AsyncClient, sign_in: SignIn) -> None:
    sales = await make_staff(sign_in, "sam")
    admin = await make_staff(sign_in, "ada", "staff_admin")
    await client.post(CONTACT, json=contact())
    await client.post(QUOTE, json=quote(email="camille@example.com"))
    [lead] = await leads(client, sales)

    url = f"{ADMIN}/leads/{lead['id']}"
    assert (await client.delete(url, headers=sales.headers)).status_code == 403
    assert (await client.delete(url, headers=admin.headers)).status_code == 204
    assert (await client.get(url, headers=admin.headers)).status_code == 404

    async with get_engine().connect() as conn:
        for table in ("contact_requests", "crm_quote_requests", "crm_opportunities"):
            count = await conn.scalar(text(f"SELECT count(*) FROM {table}"))  # noqa: S608
            assert count == 0, table
