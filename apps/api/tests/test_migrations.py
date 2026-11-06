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
