"""Migrations apply and roll back cleanly, and models match the migrated schema."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

API_ROOT = Path(__file__).resolve().parents[1]


def _config() -> Config:
    return Config(str(API_ROOT / "alembic.ini"))


def test_single_head() -> None:
    assert len(ScriptDirectory.from_config(_config()).get_heads()) == 1


def test_upgrade_downgrade_upgrade_and_no_drift() -> None:
    cfg = _config()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    command.check(cfg)  # raises if models and migrations diverge


def test_existing_contact_requests_become_prospects() -> None:
    """Migration 0005 turns the messages received before the CRM into prospects."""
    import asyncio
    import os

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    cfg = _config()
    command.downgrade(cfg, "0004")

    async def run(statements: list[str]) -> list[tuple[object, ...]]:
        engine = create_async_engine(os.environ["DATABASE_URL"])
        rows: list[tuple[object, ...]] = []
        async with engine.begin() as conn:
            for statement in statements:
                result = await conn.execute(text(statement))
                if result.returns_rows:
                    rows.extend(tuple(r) for r in result)
        await engine.dispose()
        return rows

    asyncio.run(
        run(
            [
                "INSERT INTO contact_requests (id, name, email, topic, message, locale, consent_at,"
                " status, created_at) VALUES"
                " (gen_random_uuid(), 'Old Name', 'a@example.com', 'project', 'Bonjour, un projet',"
                " 'fr', now(), 'new', now() - interval '2 days'),"
                " (gen_random_uuid(), 'New Name', 'a@example.com', 'training', 'Une formation',"
                " 'en', now(), 'processed', now() - interval '1 day'),"
                " (gen_random_uuid(), 'Bot', 'bot@example.com', 'other', 'Spam', 'fr', now(),"
                " 'spam', now())"
            ]
        )
    )
    try:
        command.upgrade(cfg, "head")
        rows = asyncio.run(
            run(
                [
                    "SELECT email, name, locale, source, status, (SELECT count(*) FROM"
                    " crm_activities a WHERE a.lead_id = l.id AND type = 'contact_message')"
                    " FROM crm_leads l",
                    "SELECT count(*) FROM contact_requests WHERE lead_id IS NULL",
                ]
            )
        )
        assert rows == [("a@example.com", "New Name", "en", "contact_form", "new", 2), (1,)]
    finally:
        asyncio.run(run(["DELETE FROM contact_requests", "DELETE FROM crm_leads"]))
