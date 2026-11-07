"""AI Gateway (EPIC 08): staff access, model registry, versioned prompts, streaming,
usage and cost records, monthly budgets and rate limits, provider failures."""

import json
from collections.abc import Awaitable, Callable, Iterator
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.cli import grant_staff
from app.core.config import get_settings
from app.db.session import get_engine
from app.modules.ai_gateway.gateway import UnprocessableError, cost, render
from app.modules.ai_gateway.models import AIModel
from app.modules.ai_gateway.providers import get_provider
from tests import ai_fakes
from tests.conftest import Actor

ADMIN = "/api/v1/admin/ai"
SignIn = Callable[[str], Awaitable[Actor]]


@pytest.fixture(scope="module")
def fake_providers() -> Iterator[str]:
    yield from ai_fakes.serve()


@pytest.fixture(autouse=True)
def ai_settings(monkeypatch: pytest.MonkeyPatch, fake_providers: str) -> Iterator[None]:
    """Simulated provider on; Anthropic pointed at the simulated server."""
    monkeypatch.setenv("AI_ENABLE_SIMULATED_PROVIDER", "true")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", fake_providers)
    get_settings.cache_clear()
    get_provider.cache_clear()
    yield
    get_settings.cache_clear()
    get_provider.cache_clear()


async def make_staff(sign_in: SignIn, name: str, role: str = "staff_admin") -> Actor:
    actor = await sign_in(name)
    await grant_staff(actor.email, role)
    return actor


async def simulated_model(client: AsyncClient, admin: Actor, **overrides: Any) -> dict[str, Any]:
    payload = {
        "provider": "simulated",
        "model_id": "echo",
        "display_name": "Simulation",
        "input_price_usd_per_mtok": "1000",
        "output_price_usd_per_mtok": "2000",
        "context_window": 100_000,
        "max_output_tokens": 50,
        **overrides,
    }
    response = await client.post(f"{ADMIN}/models", headers=admin.headers, json=payload)
    assert response.status_code == 201, response.text
    return dict(response.json())


def events(body: str) -> list[tuple[str, dict[str, Any]]]:
    parsed = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        parsed.append((lines["event"], json.loads(lines["data"])))
    return parsed


async def usage_rows() -> list[dict[str, Any]]:
    async with get_engine().connect() as conn:
        result = await conn.execute(text("SELECT * FROM ai_usage ORDER BY created_at"))
        return [dict(row._mapping) for row in result]


# --- Pure functions ------------------------------------------------------------------


def test_templates_render_variables_and_report_missing_ones() -> None:
    assert render("Résume {{ texte }} en {{langue}}.", {"texte": "ceci", "langue": "fr"}) == (
        "Résume ceci en fr."
    )
    with pytest.raises(UnprocessableError) as raised:
        render("{{a}} {{b}} {{a}}", {"b": "x"})
    assert raised.value.details == {"missing_variables": ["a"]}


def test_costs_use_registry_prices_and_exchange_rate() -> None:
    model = AIModel(input_price_usd_per_mtok=Decimal("4"), output_price_usd_per_mtok=Decimal("20"))
    usd, eur = cost(model, 1_000_000, 500_000)
    assert usd == Decimal("14")
    assert eur == (Decimal("14") * get_settings().ai_eur_per_usd).quantize(Decimal("0.000001"))


# --- Access --------------------------------------------------------------------------


async def test_only_staff_admins_manage_ai(client: AsyncClient, sign_in: SignIn) -> None:
    visitor = await sign_in("visitor")
    editor = await make_staff(sign_in, "eve", "staff_editor")
    sales = await make_staff(sign_in, "sam", "staff_sales")
    admin = await make_staff(sign_in, "ada")

    assert (await client.get(f"{ADMIN}/models")).status_code == 401
    for url in ("/models", "/prompts", "/usage"):
        assert (await client.get(ADMIN + url, headers=visitor.headers)).status_code == 404
        for actor in (editor, sales):
            assert (await client.get(ADMIN + url, headers=actor.headers)).status_code == 403
        assert (await client.get(ADMIN + url, headers=admin.headers)).status_code == 200
    playground = await client.post(
        f"{ADMIN}/playground", headers=sales.headers, json={"message": "hi"}
    )
    assert playground.status_code == 403


# --- Registry (TASK-077) -------------------------------------------------------------


async def test_registry_seeds_claude_and_tracks_the_default(
    client: AsyncClient, sign_in: SignIn
) -> None:
    admin = await make_staff(sign_in, "ada")
    models = (await client.get(f"{ADMIN}/models", headers=admin.headers)).json()
    seeded = {m["model_id"]: m for m in models}
    assert set(seeded) == {"claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"}
    assert seeded["claude-opus-5-5"]["is_default"] is True
    assert seeded["claude-opus-5-5"]["provider_configured"] is True  # key set in this test
    assert (
        seeded["claude-opus-5-5"]["input_price_usd_per_mtok"],
        seeded["claude-opus-5-5"]["output_price_usd_per_mtok"],
    ) == ("4.0000", "20.0000")

    echo = await simulated_model(client, admin, is_default=True)
    duplicate = await client.post(
        f"{ADMIN}/models",
        headers=admin.headers,
        json={**echo, "id": None, "is_default": False},
    )
    assert duplicate.status_code == 409
    models = (await client.get(f"{ADMIN}/models", headers=admin.headers)).json()
    assert [m["model_id"] for m in models if m["is_default"]] == ["echo"]

    refused = await client.patch(
        f"{ADMIN}/models/{echo['id']}", headers=admin.headers, json={"is_enabled": False}
    )
    assert refused.status_code == 409  # the default model must stay usable
    renamed = await client.patch(
        f"{ADMIN}/models/{echo['id']}",
        headers=admin.headers,
        json={"display_name": "Écho", "options": {"effort": "low"}},
    )
    assert (renamed.json()["display_name"], renamed.json()["options"]) == (
        "Écho",
        {"effort": "low"},
    )


# --- Prompts (TASK-078) --------------------------------------------------------------


async def test_prompts_are_versioned_and_keep_variables_out_of_instructions(
    client: AsyncClient, sign_in: SignIn
) -> None:
    admin = await make_staff(sign_in, "ada")
    unsafe = await client.post(
        f"{ADMIN}/prompts",
        headers=admin.headers,
        json={"key": "summary", "system": "Résume {{texte}}", "template": ""},
    )
    assert unsafe.status_code == 422

    created = await client.post(
        f"{ADMIN}/prompts",
        headers=admin.headers,
        json={
            "key": "summary.short",
            "description": "Résumé court",
            "system": "Tu résumes.",
            "template": "Résume : {{texte}}",
        },
    )
    assert created.status_code == 201
    assert created.json()["active_version"] == 1
    assert created.json()["versions"][0]["variables"] == ["texte"]
    assert (
        await client.post(
            f"{ADMIN}/prompts", headers=admin.headers, json={"key": "summary.short", "system": "x"}
        )
    ).status_code == 409

    v2 = await client.post(
        f"{ADMIN}/prompts/summary.short/versions",
        headers=admin.headers,
        json={
            "system": "Tu résumes en une phrase.",
            "template": "{{texte}}",
            "notes": "plus court",
        },
    )
    assert [v["version"] for v in v2.json()["versions"]] == [2, 1]
    assert v2.json()["active_version"] == 2
    draft = await client.post(
        f"{ADMIN}/prompts/summary.short/versions",
        headers=admin.headers,
        json={"system": "Brouillon", "activate": False},
    )
    assert draft.json()["active_version"] == 2
    rolled_back = await client.post(
        f"{ADMIN}/prompts/summary.short/versions/1/activate", headers=admin.headers
    )
    assert rolled_back.json()["active_version"] == 1
    listing = (await client.get(f"{ADMIN}/prompts", headers=admin.headers)).json()
    assert [(p["key"], p["active_version"], p["versions"]) for p in listing] == [
        ("summary.short", 1, 3)
    ]


# --- Streaming, usage and costs (TASK-079, TASK-080) ---------------------------------


async def test_playground_streams_and_records_usage_without_content(
    client: AsyncClient, sign_in: SignIn
) -> None:
    admin = await make_staff(sign_in, "ada")
    echo = await simulated_model(client, admin)
    await client.post(
        f"{ADMIN}/prompts",
        headers=admin.headers,
        json={"key": "greet", "system": "Tu salues.", "template": "Salue {{nom}}"},
    )

    response = await client.post(
        f"{ADMIN}/playground",
        headers=admin.headers,
        json={"model_id": echo["id"], "prompt_key": "greet", "variables": {"nom": "Camille"}},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    stream = events(response.text)
    assert (
        "".join(d["text"] for kind, d in stream if kind == "delta") == "[simulation] Salue Camille"
    )
    kind, done = stream[-1]
    assert kind == "done"
    assert (done["output_tokens"], done["stop_reason"]) == (3, "end")

    [row] = await usage_rows()
    assert (row["feature"], row["provider"], row["model"], row["status"]) == (
        "playground",
        "simulated",
        "echo",
        "ok",
    )
    assert (row["prompt_key"], row["prompt_version"]) == ("greet", 1)
    assert (row["input_tokens"], row["output_tokens"]) == (4, 3)
    assert row["cost_usd"] == Decimal("0.010000")  # 4 x 1000 $/M + 3 x 2000 $/M
    assert "Camille" not in json.dumps({k: str(v) for k, v in row.items()})

    report = (await client.get(f"{ADMIN}/usage", headers=admin.headers)).json()
    assert report["models"][0]["calls"] == 1
    internal = next(o for o in report["organizations"] if o["organization_name"] == "DEV4INNOVA")
    assert (internal["calls"], Decimal(internal["spent_eur"]) > 0) == (1, True)


async def test_prompt_variables_must_all_be_given(client: AsyncClient, sign_in: SignIn) -> None:
    admin = await make_staff(sign_in, "ada")
    await simulated_model(client, admin, is_default=True)
    await client.post(
        f"{ADMIN}/prompts",
        headers=admin.headers,
        json={"key": "greet", "system": "x", "template": "{{a}} {{b}}"},
    )
    response = await client.post(
        f"{ADMIN}/playground",
        headers=admin.headers,
        json={"prompt_key": "greet", "variables": {"a": "1"}},
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"]["missing_variables"] == ["b"]


async def test_the_real_anthropic_adapter_runs_through_the_gateway(
    client: AsyncClient, sign_in: SignIn
) -> None:
    admin = await make_staff(sign_in, "ada")
    response = await client.post(
        f"{ADMIN}/playground",
        headers=admin.headers,
        json={"system": "Sois bref.", "message": "Bonjour"},
    )
    stream = events(response.text)
    assert "".join(d["text"] for kind, d in stream if kind == "delta") == "Bonjour le monde"
    sent = ai_fakes.LAST_REQUESTS["anthropic"]["body"]
    assert (sent["model"], sent["system"], sent["max_tokens"]) == (
        "claude-opus-5-5",
        "Sois bref.",
        16000,
    )
    assert (sent["output_config"], sent["fallbacks"]) == ({"effort": "medium"}, "default")
    [row] = await usage_rows()
    # 12 input tokens x 4 $/M + 5 output tokens x 20 $/M
    assert row["cost_usd"] == Decimal("0.000148")


async def test_provider_failures_end_the_stream_and_are_recorded(
    client: AsyncClient, sign_in: SignIn
) -> None:
    admin = await make_staff(sign_in, "ada")
    broken = await client.post(
        f"{ADMIN}/models",
        headers=admin.headers,
        json={
            "provider": "anthropic",
            "model_id": "error-401",
            "display_name": "Cassé",
            "input_price_usd_per_mtok": "1",
            "output_price_usd_per_mtok": "1",
            "context_window": 1000,
            "max_output_tokens": 10,
        },
    )
    response = await client.post(
        f"{ADMIN}/playground",
        headers=admin.headers,
        json={"model_id": broken.json()["id"], "message": "x"},
    )
    assert events(response.text) == [
        ("error", {"code": "ai_provider_error", "message": "The AI provider could not answer"})
    ]
    [row] = await usage_rows()
    assert (row["status"], row["error_code"], row["cost_eur"]) == (
        "error",
        "provider_auth",
        Decimal(0),
    )


async def test_unconfigured_providers_are_refused_before_any_call(
    client: AsyncClient, sign_in: SignIn, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = await make_staff(sign_in, "ada")
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    get_settings.cache_clear()
    get_provider.cache_clear()
    response = await client.post(
        f"{ADMIN}/playground", headers=admin.headers, json={"message": "x"}
    )
    assert response.status_code == 503
    assert response.json()["error"]["details"] == {"provider": "anthropic"}
    assert await usage_rows() == []


# --- Quotas (TASK-081) ---------------------------------------------------------------


async def test_monthly_budget_bounds_the_worst_case_cost(
    client: AsyncClient, sign_in: SignIn
) -> None:
    admin = await make_staff(sign_in, "ada")
    echo = await simulated_model(client, admin, is_default=True)
    internal = next(
        o["organization_id"]
        for o in (await client.get(f"{ADMIN}/usage", headers=admin.headers)).json()["organizations"]
        if o["organization_name"] == "DEV4INNOVA"
    )
    # Worst case of one call: ~1 input token x 1000 $/M + 50 output tokens x 2000 $/M ≈ 0.09 €
    await client.put(
        f"{ADMIN}/quotas/{internal}", headers=admin.headers, json={"monthly_budget_eur": "0.05"}
    )
    refused = await client.post(f"{ADMIN}/playground", headers=admin.headers, json={"message": "x"})
    assert refused.status_code == 429
    assert refused.json()["error"]["code"] == "ai_quota_exceeded"

    await client.put(
        f"{ADMIN}/quotas/{internal}", headers=admin.headers, json={"monthly_budget_eur": "1"}
    )
    assert (
        await client.post(f"{ADMIN}/playground", headers=admin.headers, json={"message": "x"})
    ).status_code == 200
    report = (await client.get(f"{ADMIN}/usage", headers=admin.headers)).json()
    org = next(o for o in report["organizations"] if o["organization_id"] == internal)
    assert (org["monthly_budget_eur"], org["has_specific_budget"]) == ("1.00", True)

    await client.put(
        f"{ADMIN}/quotas/{internal}", headers=admin.headers, json={"monthly_budget_eur": None}
    )
    report = (await client.get(f"{ADMIN}/usage", headers=admin.headers)).json()
    org = next(o for o in report["organizations"] if o["organization_id"] == internal)
    assert org["has_specific_budget"] is False
    assert echo["model_id"] == "echo"


async def test_per_user_rate_limit(
    client: AsyncClient, sign_in: SignIn, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = await make_staff(sign_in, "ada")
    await simulated_model(
        client, admin, is_default=True, input_price_usd_per_mtok="0", output_price_usd_per_mtok="0"
    )
    monkeypatch.setenv("AI_USER_REQUESTS_PER_MINUTE", "2")
    get_settings.cache_clear()
    codes = [
        (
            await client.post(f"{ADMIN}/playground", headers=admin.headers, json={"message": "x"})
        ).status_code
        for _ in range(3)
    ]
    assert codes == [200, 200, 429]
