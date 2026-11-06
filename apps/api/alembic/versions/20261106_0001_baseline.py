"""Baseline: empty schema, starting point of the migration history.

Revision ID: 0001
Revises:
Create Date: 2026-11-06
"""

from collections.abc import Sequence

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """No tables yet: domain tables arrive with EPIC 04 (identity)."""


def downgrade() -> None:
    """Nothing to undo."""
