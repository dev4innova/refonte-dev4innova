"""CRM: prospects, opportunities, activities and quote requests (EPIC 07).

Also links each website contact request to a prospect, and turns the contact requests
received so far into prospects of the internal organization (one per email address, the
spam excepted), each message becoming a "contact_message" activity.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INTERNAL_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001"

BACKFILL = [
    # One prospect per address, with the latest name and company given.
    """
    INSERT INTO crm_leads (id, organization_id, email, name, company, locale, source, status,
                           last_activity_at, created_at, updated_at)
    SELECT gen_random_uuid(), CAST(:org AS uuid), email, name, company, locale,
           'contact_form', 'new', last_at, first_at, now()
    FROM (
        SELECT DISTINCT ON (email) email, name, company, locale,
               max(created_at) OVER (PARTITION BY email) AS last_at,
               min(created_at) OVER (PARTITION BY email) AS first_at
        FROM contact_requests
        WHERE status <> 'spam'
        ORDER BY email, created_at DESC
    ) AS latest
    """,
    """
    UPDATE contact_requests SET lead_id = crm_leads.id
    FROM crm_leads
    WHERE crm_leads.organization_id = CAST(:org AS uuid)
      AND crm_leads.email = contact_requests.email
      AND contact_requests.status <> 'spam'
    """,
    """
    INSERT INTO crm_activities (id, organization_id, lead_id, type, body, details, occurred_at,
                                created_at, updated_at)
    SELECT gen_random_uuid(), CAST(:org AS uuid), lead_id, 'contact_message', message,
           jsonb_build_object('topic', topic, 'contact_request_id', id), created_at,
           created_at, now()
    FROM contact_requests
    WHERE lead_id IS NOT NULL
    """,
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "crm_leads",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("company", sa.String(length=160), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("locale", sa.String(length=2), server_default="fr", nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="new", nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("locale IN ('fr', 'en')", name=op.f("ck_crm_leads_locale")),
        sa.CheckConstraint(
            "source IN ('contact_form', 'quote_request', 'manual')",
            name=op.f("ck_crm_leads_source"),
        ),
        sa.CheckConstraint(
            "status IN ('new', 'contacted', 'qualified', 'customer', 'unqualified')",
            name=op.f("ck_crm_leads_status"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_crm_leads_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_crm_leads_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_crm_leads_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_crm_leads")),
        sa.UniqueConstraint("organization_id", "email", name="uq_crm_leads_organization_id_email"),
    )
    op.create_index(
        "ix_crm_leads_org_owner", "crm_leads", ["organization_id", "owner_id"], unique=False
    )
    op.create_index(
        "ix_crm_leads_org_status", "crm_leads", ["organization_id", "status"], unique=False
    )
    op.create_index(
        op.f("ix_crm_leads_organization_id"), "crm_leads", ["organization_id"], unique=False
    )
    op.create_table(
        "crm_opportunities",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("stage", sa.String(length=20), server_default="qualification", nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="EUR", nullable=False),
        sa.Column("expected_close_on", sa.Date(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "stage IN ('qualification', 'proposal', 'negotiation', 'won', 'lost')",
            name=op.f("ck_crm_opportunities_stage"),
        ),
        sa.CheckConstraint(
            "amount IS NULL OR amount >= 0", name=op.f("ck_crm_opportunities_amount")
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["crm_leads.id"],
            name=op.f("fk_crm_opportunities_lead_id_crm_leads"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_crm_opportunities_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_crm_opportunities_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_crm_opportunities")),
    )
    op.create_index(
        op.f("ix_crm_opportunities_lead_id"), "crm_opportunities", ["lead_id"], unique=False
    )
    op.create_index(
        "ix_crm_opportunities_org_stage",
        "crm_opportunities",
        ["organization_id", "stage"],
        unique=False,
    )
    op.create_index(
        op.f("ix_crm_opportunities_organization_id"),
        "crm_opportunities",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "crm_activities",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("body", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "details", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "type IN ('note', 'call', 'email', 'meeting', 'contact_message', 'quote_request', 'status_change', 'stage_change', 'assignment')",
            name=op.f("ck_crm_activities_type"),
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name=op.f("fk_crm_activities_author_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["crm_leads.id"],
            name=op.f("fk_crm_activities_lead_id_crm_leads"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["crm_opportunities.id"],
            name=op.f("fk_crm_activities_opportunity_id_crm_opportunities"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_crm_activities_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_crm_activities")),
    )
    op.create_index(op.f("ix_crm_activities_lead_id"), "crm_activities", ["lead_id"], unique=False)
    op.create_index(
        op.f("ix_crm_activities_opportunity_id"), "crm_activities", ["opportunity_id"], unique=False
    )
    op.create_index(
        "ix_crm_activities_org_lead_occurred",
        "crm_activities",
        ["organization_id", "lead_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_crm_activities_organization_id"),
        "crm_activities",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "crm_quote_requests",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=True),
        sa.Column("service", sa.String(length=120), nullable=True),
        sa.Column("need", sa.Text(), nullable=False),
        sa.Column("budget", sa.String(length=20), nullable=False),
        sa.Column("timeline", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="new", nullable=False),
        sa.Column("locale", sa.String(length=2), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "budget IN ('lt_10k', '10k_30k', '30k_100k', 'gt_100k', 'unknown')",
            name=op.f("ck_crm_quote_requests_budget"),
        ),
        sa.CheckConstraint("locale IN ('fr', 'en')", name=op.f("ck_crm_quote_requests_locale")),
        sa.CheckConstraint(
            "status IN ('new', 'in_review', 'answered', 'declined')",
            name=op.f("ck_crm_quote_requests_status"),
        ),
        sa.CheckConstraint(
            "timeline IN ('asap', 'within_3_months', 'within_6_months', 'unknown')",
            name=op.f("ck_crm_quote_requests_timeline"),
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["crm_leads.id"],
            name=op.f("fk_crm_quote_requests_lead_id_crm_leads"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["crm_opportunities.id"],
            name=op.f("fk_crm_quote_requests_opportunity_id_crm_opportunities"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_crm_quote_requests_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_crm_quote_requests")),
    )
    op.create_index(
        op.f("ix_crm_quote_requests_lead_id"), "crm_quote_requests", ["lead_id"], unique=False
    )
    op.create_index(
        op.f("ix_crm_quote_requests_opportunity_id"),
        "crm_quote_requests",
        ["opportunity_id"],
        unique=False,
    )
    op.create_index(
        "ix_crm_quote_requests_org_status",
        "crm_quote_requests",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_crm_quote_requests_organization_id"),
        "crm_quote_requests",
        ["organization_id"],
        unique=False,
    )
    op.add_column("contact_requests", sa.Column("lead_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_contact_requests_lead_id"), "contact_requests", ["lead_id"], unique=False
    )
    op.create_foreign_key(
        op.f("fk_contact_requests_lead_id_crm_leads"),
        "contact_requests",
        "crm_leads",
        ["lead_id"],
        ["id"],
        ondelete="SET NULL",
    )
    for statement in BACKFILL:
        op.execute(sa.text(statement).bindparams(org=INTERNAL_ORGANIZATION_ID))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        op.f("fk_contact_requests_lead_id_crm_leads"), "contact_requests", type_="foreignkey"
    )
    op.drop_index(op.f("ix_contact_requests_lead_id"), table_name="contact_requests")
    op.drop_column("contact_requests", "lead_id")
    op.drop_index(op.f("ix_crm_quote_requests_organization_id"), table_name="crm_quote_requests")
    op.drop_index("ix_crm_quote_requests_org_status", table_name="crm_quote_requests")
    op.drop_index(op.f("ix_crm_quote_requests_opportunity_id"), table_name="crm_quote_requests")
    op.drop_index(op.f("ix_crm_quote_requests_lead_id"), table_name="crm_quote_requests")
    op.drop_table("crm_quote_requests")
    op.drop_index(op.f("ix_crm_activities_organization_id"), table_name="crm_activities")
    op.drop_index("ix_crm_activities_org_lead_occurred", table_name="crm_activities")
    op.drop_index(op.f("ix_crm_activities_opportunity_id"), table_name="crm_activities")
    op.drop_index(op.f("ix_crm_activities_lead_id"), table_name="crm_activities")
    op.drop_table("crm_activities")
    op.drop_index(op.f("ix_crm_opportunities_organization_id"), table_name="crm_opportunities")
    op.drop_index("ix_crm_opportunities_org_stage", table_name="crm_opportunities")
    op.drop_index(op.f("ix_crm_opportunities_lead_id"), table_name="crm_opportunities")
    op.drop_table("crm_opportunities")
    op.drop_index(op.f("ix_crm_leads_organization_id"), table_name="crm_leads")
    op.drop_index("ix_crm_leads_org_status", table_name="crm_leads")
    op.drop_index("ix_crm_leads_org_owner", table_name="crm_leads")
    op.drop_table("crm_leads")
