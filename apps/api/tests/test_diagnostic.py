"""AI business diagnostic (EPIC 10): questionnaire, scoring, recommendations, unlocking and
CRM link, AI analysis, PDF report, back office and retention."""

import io
import json
from collections.abc import Awaitable, Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from pypdf import PdfReader
from sqlalchemy import text

from app.cli import grant_staff
from app.core.config import get_settings
from app.db.session import get_engine, new_session
from app.modules.ai_gateway.providers import get_provider
from app.modules.diagnostic.questionnaire import DIMENSIONS
from app.modules.diagnostic.scoring import level_for, priorities, score
from app.modules.diagnostic.service import purge_anonymous
from tests import ai_fakes
from tests.conftest import Actor

PUBLIC = "/api/v1/diagnostic"
ADMIN = "/api/v1/admin/crm/diagnostics"
SignIn = Callable[[str], Awaitable[Actor]]


@pytest.fixture(scope="module")
def fake_providers() -> Iterator[str]:
    yield from ai_fakes.serve()


@pytest.fixture(autouse=True)
def ai_settings(monkeypatch: pytest.MonkeyPatch, fake_providers: str) -> Iterator[None]:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", fake_providers)
    get_settings.cache_clear()
    get_provider.cache_clear()
    yield
    get_settings.cache_clear()
    get_provider.cache_clear()


def answers(levels: dict[str, int] | None = None, default: int = 1) -> dict[str, str]:
    """Same answer level for every question of a dimension."""
    levels = levels or {}
    return {
        question.id: f"{question.id}.{levels.get(dimension.id, default)}"
        for dimension in DIMENSIONS
        for question in dimension.questions
    }


async def submit(client: AsyncClient, **body: Any) -> str:
    payload = {
        "locale": "fr",
        "answers": answers({"strategy": 0, "data": 3, "governance": 0}),
        "profile": {"sector": "industry", "size": "10-49"},
        **body,
    }
    response = await client.post(PUBLIC, json=payload)
    assert response.status_code == 201, response.text
    return str(response.json()["token"])


async def unlock(client: AsyncClient, token: str, **body: Any) -> Any:
    payload = {
        "name": "Dominique Martin",
        "email": "Dominique@Example.com",
        "company": "Globex",
        "consent": True,
        **body,
    }
    return await client.post(f"{PUBLIC}/unlock", params={"token": token}, json=payload)


def events(body: str) -> list[tuple[str, dict[str, Any]]]:
    return [
        (lines["event"], json.loads(lines["data"]))
        for lines in (
            dict(line.split(": ", 1) for line in block.splitlines())
            for block in body.strip().split("\n\n")
        )
    ]


# --- Questionnaire and scoring (TASK-089 to TASK-091) --------------------------------


async def test_questionnaire_in_both_languages(client: AsyncClient) -> None:
    fr = (await client.get(f"{PUBLIC}/questionnaire")).json()
    en = (await client.get(f"{PUBLIC}/questionnaire", params={"locale": "en"})).json()
    assert [d["id"] for d in fr["dimensions"]] == [
        "strategy",
        "data",
        "technology",
        "skills",
        "governance",
    ]
    assert sum(len(d["questions"]) for d in fr["dimensions"]) == 20
    assert all(len(q["options"]) == 4 for d in fr["dimensions"] for q in d["questions"])
    assert [p["id"] for p in fr["profile"]] == ["sector", "size", "role"]
    assert fr["dimensions"][1]["label"] == "Données"
    assert en["dimensions"][1]["label"] == "Data"
    assert fr["version"] == en["version"]


def test_scores_levels_and_priorities() -> None:
    assert score(answers(default=0)).overall == 0
    assert score(answers(default=3)).overall == 100
    mixed = score(answers({"strategy": 0, "data": 3, "governance": 0}))
    assert mixed.dimensions == {
        "strategy": 0,
        "data": 100,
        "technology": 33,
        "skills": 33,
        "governance": 0,
    }
    assert (mixed.overall, mixed.level) == (33, "experimentation")
    assert [level_for(s) for s in (0, 24, 25, 49, 50, 74, 75, 100)] == [
        "discovery",
        "discovery",
        "experimentation",
        "experimentation",
        "structuring",
        "structuring",
        "transformation",
        "transformation",
    ]
    # Weakest dimensions first; ties ordered by name; a solid dimension gets the next step.
    assert [r.id for r in priorities(mixed.dimensions)] == [
        "governance.policy",
        "strategy.workshop",
        "skills.awareness",
    ]


async def test_answers_are_validated(client: AsyncClient) -> None:
    complete = answers()
    missing = {k: v for k, v in complete.items() if k != "data.quality"}
    response = await client.post(PUBLIC, json={"answers": missing})
    assert response.status_code == 422
    assert response.json()["error"]["details"] == {"missing": ["data.quality"], "invalid": []}

    swapped = {**complete, "data.quality": "data.access.2", "nope": "nope.1"}
    details = (await client.post(PUBLIC, json={"answers": swapped})).json()["error"]["details"]
    assert sorted(details["invalid"]) == ["data.quality", "nope"]
    bad_profile = await client.post(PUBLIC, json={"answers": complete, "profile": {"size": "huge"}})
    assert bad_profile.status_code == 422


# --- Result and unlocking (TASK-093, TASK-095) ---------------------------------------


async def test_result_is_a_teaser_until_an_email_is_left(client: AsyncClient) -> None:
    token = await submit(client)
    result = (await client.get(f"{PUBLIC}/result", params={"token": token})).json()
    assert (result["overall_score"], result["level"], result["level_label"]) == (
        33,
        "experimentation",
        "Expérimentation",
    )
    assert {d["id"]: d["score"] for d in result["dimensions"]}["data"] == 100
    assert [p["id"] for p in result["priorities"]] == [
        "governance.policy",
        "strategy.workshop",
        "skills.awareness",
    ]
    assert all(p["text"] is None for p in result["priorities"])
    assert (result["unlocked"], result["report"]) == (False, None)

    async with get_engine().connect() as conn:
        stored = (
            await conn.execute(text("SELECT token_hash, contact_email FROM diagnostics"))
        ).one()
    assert stored.token_hash != token and len(stored.token_hash) == 64  # only the hash is kept
    assert stored.contact_email is None
    assert (await client.get(f"{PUBLIC}/result", params={"token": "x" * 43})).status_code == 404


async def test_honeypot_stores_nothing(client: AsyncClient) -> None:
    response = await client.post(
        PUBLIC, json={"answers": answers(), "website": "https://spam.example"}
    )
    assert response.status_code == 201
    assert (
        await client.get(f"{PUBLIC}/result", params={"token": response.json()["token"]})
    ).status_code == 404


async def test_unlocking_gives_the_report_and_feeds_the_crm(
    client: AsyncClient, sign_in: SignIn
) -> None:
    token = await submit(client)
    assert (await unlock(client, token, consent=False)).status_code == 422

    unlocked = (await unlock(client, token)).json()
    assert unlocked["unlocked"] is True
    report = unlocked["report"]
    assert report["company"] == "Globex"
    assert len(report["recommendations"]) >= 5 and all(r["text"] for r in report["recommendations"])
    assert report["ai_status"] == "none"
    assert all(p["text"] for p in unlocked["priorities"])
    await unlock(client, token)  # again: nothing new recorded

    sales = await sign_in("sam")
    await grant_staff(sales.email, "staff_sales")
    [lead] = (await client.get("/api/v1/admin/crm/leads", headers=sales.headers)).json()["items"]
    assert (lead["email"], lead["source"], lead["company"]) == (
        "dominique@example.com",
        "diagnostic",
        "Globex",
    )
    detail = (
        await client.get(f"/api/v1/admin/crm/leads/{lead['id']}", headers=sales.headers)
    ).json()
    [activity] = [a for a in detail["activities"] if a["type"] == "diagnostic"]
    assert (activity["details"]["score"], activity["details"]["level_label"]) == (
        33,
        "Expérimentation",
    )
    assert activity["details"]["profile"] == {"sector": "industry", "size": "10-49"}


async def test_a_known_prospect_keeps_its_source(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/contact-requests",
        json={
            "name": "Dominique Martin",
            "email": "dominique@example.com",
            "message": "Nous voulons parler d'un projet d'IA générative.",
            "consent": True,
        },
    )
    await unlock(client, await submit(client))
    async with get_engine().connect() as conn:
        rows = (await conn.execute(text("SELECT source FROM crm_leads"))).all()
        types = (
            (await conn.execute(text("SELECT type FROM crm_activities ORDER BY occurred_at")))
            .scalars()
            .all()
        )
    assert [r.source for r in rows] == ["contact_form"]
    assert list(types) == ["contact_message", "diagnostic"]


# --- AI analysis (TASK-092) ----------------------------------------------------------


async def test_the_analysis_is_written_once_then_replayed(client: AsyncClient) -> None:
    token = await submit(client)
    assert (await client.post(f"{PUBLIC}/analysis", params={"token": token})).status_code == 403
    await unlock(client, token)

    first = await client.post(f"{PUBLIC}/analysis", params={"token": token})
    assert (
        "".join(d["text"] for kind, d in events(first.text) if kind == "delta")
        == "Bonjour le monde"
    )
    request = ai_fakes.LAST_REQUESTS["anthropic"]["body"]
    assert request["system"].startswith("You are a senior AI consultant at DEV4INNOVA")
    prompt = request["messages"][0]["content"]
    assert prompt.startswith("Language of the analysis: French")
    assert "Secteur d'activité: Industrie" in prompt
    assert "- Données: 100/100" in prompt
    assert "Existe-t-il une charte d'usage de l'IA ? Non" in prompt

    result = (await client.get(f"{PUBLIC}/result", params={"token": token})).json()
    assert (result["report"]["ai_status"], result["report"]["ai_analysis"]) == (
        "done",
        "Bonjour le monde",
    )
    again = await client.post(f"{PUBLIC}/analysis", params={"token": token})
    assert events(again.text)[0] == ("delta", {"text": "Bonjour le monde"})
    async with get_engine().connect() as conn:
        usage = (
            await conn.execute(text("SELECT feature, organization_id::text, user_id FROM ai_usage"))
        ).all()
    assert usage == [("diagnostic", "00000000-0000-4000-8000-000000000001", None)]


async def test_only_one_analysis_at_a_time_and_failures_can_be_retried(client: AsyncClient) -> None:
    token = await submit(client)
    await unlock(client, token)
    async with get_engine().begin() as conn:
        await conn.execute(
            text("UPDATE diagnostics SET ai_status = 'pending', ai_started_at = now()")
        )
    assert (await client.post(f"{PUBLIC}/analysis", params={"token": token})).status_code == 409

    async with get_engine().begin() as conn:
        await conn.execute(text("UPDATE diagnostics SET ai_status = 'none'"))
        await conn.execute(text("UPDATE ai_models SET model_id = 'error-401' WHERE is_default"))
    try:
        failed = await client.post(f"{PUBLIC}/analysis", params={"token": token})
        assert events(failed.text)[-1][0] == "error"
        result = (await client.get(f"{PUBLIC}/result", params={"token": token})).json()
        assert result["report"]["ai_status"] == "error"
    finally:
        async with get_engine().begin() as conn:
            await conn.execute(
                text("UPDATE ai_models SET model_id = 'claude-opus-5-5' WHERE is_default")
            )
    retried = await client.post(f"{PUBLIC}/analysis", params={"token": token})
    assert events(retried.text)[-1] == ("done", {"stop_reason": "end"})


async def test_daily_limit_of_public_analyses(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("AI_DIAGNOSTIC_DAILY_ANALYSES", "1")
    get_settings.cache_clear()
    tokens = [await submit(client), await submit(client)]
    for token in tokens:
        await unlock(client, token, email=f"{token[:6].lower()}@example.com")
    assert (await client.post(f"{PUBLIC}/analysis", params={"token": tokens[0]})).status_code == 200
    refused = await client.post(f"{PUBLIC}/analysis", params={"token": tokens[1]})
    assert (refused.status_code, refused.json()["error"]["code"]) == (429, "diagnostic_daily_limit")


# --- PDF report (TASK-094) -----------------------------------------------------------


async def test_the_pdf_report_requires_the_email(client: AsyncClient) -> None:
    token = await submit(client)
    assert (await client.get(f"{PUBLIC}/report.pdf", params={"token": token})).status_code == 403
    await unlock(client, token, company="Globex & Fils <SA>")
    await client.post(f"{PUBLIC}/analysis", params={"token": token})

    response = await client.get(f"{PUBLIC}/report.pdf", params={"token": token})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert 'filename="diagnostic-ia.pdf"' in response.headers["content-disposition"]
    content = "\n".join(
        page.extract_text() for page in PdfReader(io.BytesIO(response.content)).pages
    )
    for expected in (
        "Diagnostic de maturité IA",
        "Pour Globex & Fils <SA>",
        "33",
        "Expérimentation",
        "Rédiger une charte d'usage de l'IA",
        "Bonjour le monde",
    ):
        assert expected in content, expected


# --- Back office (TASK-093, TASK-095) ------------------------------------------------


async def test_staff_see_diagnostics_and_their_reports(
    client: AsyncClient, sign_in: SignIn
) -> None:
    sales = await sign_in("sam")
    await grant_staff(sales.email, "staff_sales")
    editor = await sign_in("eve")
    await grant_staff(editor.email, "staff_editor")
    visitor = await sign_in("vic")
    await submit(client)  # anonymous: listed only on demand
    await unlock(client, await submit(client))

    listing = (await client.get(ADMIN, headers=sales.headers)).json()
    assert listing["total"] == 1
    [item] = listing["items"]
    assert (item["contact_company"], item["sector"], item["unlocked"]) == (
        "Globex",
        "industry",
        True,
    )
    everything = (
        await client.get(ADMIN, headers=sales.headers, params={"unlocked_only": False})
    ).json()
    assert everything["total"] == 2
    locked = next(i for i in everything["items"] if not i["unlocked"])
    staff_view = (await client.get(f"{ADMIN}/{locked['id']}", headers=sales.headers)).json()
    assert staff_view["unlocked"] is False and staff_view["report"]["recommendations"]
    pdf = await client.get(f"{ADMIN}/{item['id']}/report.pdf", headers=sales.headers)
    assert pdf.content.startswith(b"%PDF")
    assert (await client.get(ADMIN, headers=editor.headers)).status_code == 403
    assert (await client.get(ADMIN, headers=visitor.headers)).status_code == 404


# --- Data protection ------------------------------------------------------------------


async def test_erasing_the_prospect_erases_its_diagnostics(
    client: AsyncClient, sign_in: SignIn
) -> None:
    admin = await sign_in("ada")
    await grant_staff(admin.email, "staff_admin")
    await unlock(client, await submit(client))
    [lead] = (await client.get("/api/v1/admin/crm/leads", headers=admin.headers)).json()["items"]
    assert (
        await client.delete(f"/api/v1/admin/crm/leads/{lead['id']}", headers=admin.headers)
    ).status_code == 204
    async with get_engine().connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM diagnostics")) == 0


async def test_old_anonymous_diagnostics_are_purged(client: AsyncClient) -> None:
    await submit(client)
    await unlock(client, await submit(client))
    old = datetime.now(UTC) - timedelta(days=31)
    async with get_engine().begin() as conn:
        await conn.execute(text("UPDATE diagnostics SET created_at = :old"), {"old": old})
    async with new_session() as session:
        assert await purge_anonymous(session) == 1
    async with get_engine().connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM diagnostics")) == 1


async def test_submissions_are_rate_limited(client: AsyncClient) -> None:
    codes = [
        (await client.post(PUBLIC, json={"answers": answers()})).status_code for _ in range(11)
    ]
    assert codes[-1] == 429 and codes[:10] == [201] * 10
