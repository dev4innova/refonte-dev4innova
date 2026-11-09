"""Commerce and billing (EPIC 13): catalog, billing profiles, quotes, invoices and credit
notes, payments, subscriptions, Stripe checkouts and events, gapless counters; billing
notification types.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOTIFICATIONS_BEFORE = "'project_created', 'task_client_review', 'deliverable_submitted', 'document_shared', 'ticket_replied', 'ticket_status', 'deliverable_reviewed', 'document_uploaded', 'ticket_opened', 'ticket_message', 'comment_added'"
NOTIFICATIONS_AFTER = (
    "'project_created', 'task_client_review', 'deliverable_submitted', 'document_shared', 'ticket_replied', 'ticket_status', 'quote_sent', 'invoice_issued', "
    "'deliverable_reviewed', 'document_uploaded', 'ticket_opened', 'ticket_message', 'comment_added', 'quote_accepted', 'quote_declined', 'payment_received'"
)


def _notification_types(values: str) -> None:
    # op.f(): the name is final (the naming convention must not prefix it again).
    op.drop_constraint(op.f("ck_notifications_type"), "notifications", type_="check")
    op.create_check_constraint(
        op.f("ck_notifications_type"), "notifications", f"type IN ({values})"
    )


def upgrade() -> None:
    op.create_table(
        "billing_counters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("series", sa.String(length=2), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_counters")),
        sa.UniqueConstraint("series", "year", name="uq_billing_counters_series_year"),
    )
    op.create_table(
        "billing_stripe_events",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("type", sa.String(length=80), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_stripe_events")),
    )
    op.create_table(
        "billing_profiles",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("legal_name", sa.String(length=200), nullable=False),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("postal_code", sa.String(length=20), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("country", sa.String(length=2), server_default="FR", nullable=False),
        sa.Column("vat_number", sa.String(length=30), nullable=True),
        sa.Column("siren", sa.String(length=14), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("stripe_customer_id", sa.String(length=60), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_billing_profiles_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_profiles")),
        sa.UniqueConstraint("organization_id", name=op.f("uq_billing_profiles_organization_id")),
    )
    op.create_table(
        "billing_products",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=60), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column(
            "name", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column(
            "description",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("unit_price_cents", sa.BigInteger(), nullable=False),
        sa.Column("vat_rate_bp", sa.Integer(), server_default="2000", nullable=False),
        sa.Column("interval", sa.String(length=10), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
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
            "(kind = 'course') = (course_id IS NOT NULL)",
            name=op.f("ck_billing_products_course_kind"),
        ),
        sa.CheckConstraint(
            "(kind = 'subscription') = (interval IS NOT NULL)",
            name=op.f("ck_billing_products_interval_kind"),
        ),
        sa.CheckConstraint(
            "interval IN ('month', 'year')", name=op.f("ck_billing_products_interval")
        ),
        sa.CheckConstraint(
            "kind IN ('service', 'subscription', 'course')", name=op.f("ck_billing_products_kind")
        ),
        sa.CheckConstraint("unit_price_cents >= 0", name=op.f("ck_billing_products_price")),
        sa.CheckConstraint("vat_rate_bp BETWEEN 0 AND 10000", name=op.f("ck_billing_products_vat")),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["academy_courses.id"],
            name=op.f("fk_billing_products_course_id_academy_courses"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_billing_products_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_products")),
        sa.UniqueConstraint("code", name=op.f("uq_billing_products_code")),
        sa.UniqueConstraint("course_id", name=op.f("uq_billing_products_course_id")),
    )
    op.create_index(
        op.f("ix_billing_products_organization_id"),
        "billing_products",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "billing_quotes",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("deposit_percent", sa.Integer(), server_default="0", nullable=False),
        sa.Column("net_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("vat_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("gross_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_by_id", sa.Uuid(), nullable=True),
        sa.Column("acceptance_name", sa.String(length=200), nullable=True),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decline_reason", sa.Text(), nullable=True),
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
            "status IN ('draft', 'sent', 'accepted', 'declined', 'cancelled')",
            name=op.f("ck_billing_quotes_status"),
        ),
        sa.CheckConstraint(
            "deposit_percent BETWEEN 0 AND 100", name=op.f("ck_billing_quotes_deposit")
        ),
        sa.ForeignKeyConstraint(
            ["accepted_by_id"],
            ["users.id"],
            name=op.f("fk_billing_quotes_accepted_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_billing_quotes_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["crm_opportunities.id"],
            name=op.f("fk_billing_quotes_opportunity_id_crm_opportunities"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_billing_quotes_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_quotes")),
        sa.UniqueConstraint("number", name=op.f("uq_billing_quotes_number")),
    )
    op.create_index(
        "ix_billing_quotes_org_status",
        "billing_quotes",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_quotes_organization_id"),
        "billing_quotes",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "billing_subscriptions",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="incomplete", nullable=False),
        sa.Column("stripe_subscription_id", sa.String(length=80), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "status IN ('incomplete', 'active', 'past_due', 'cancelled')",
            name=op.f("ck_billing_subscriptions_status"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_billing_subscriptions_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_billing_subscriptions_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["billing_products.id"],
            name=op.f("fk_billing_subscriptions_product_id_billing_products"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_subscriptions")),
        sa.UniqueConstraint(
            "stripe_subscription_id", name=op.f("uq_billing_subscriptions_stripe_subscription_id")
        ),
    )
    op.create_index(
        "ix_billing_subscriptions_org",
        "billing_subscriptions",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_subscriptions_organization_id"),
        "billing_subscriptions",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "billing_invoices",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(length=20), nullable=False),
        sa.Column("kind", sa.String(length=20), server_default="invoice", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="issued", nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("seller", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("customer", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("net_cents", sa.BigInteger(), nullable=False),
        sa.Column("vat_cents", sa.BigInteger(), nullable=False),
        sa.Column("gross_cents", sa.BigInteger(), nullable=False),
        sa.Column("paid_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("quote_id", sa.Uuid(), nullable=True),
        sa.Column("subscription_id", sa.Uuid(), nullable=True),
        sa.Column("credited_invoice_id", sa.Uuid(), nullable=True),
        sa.Column("issued_by_id", sa.Uuid(), nullable=True),
        sa.Column("external_ref", sa.String(length=80), nullable=True),
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
            "kind IN ('invoice', 'credit_note')", name=op.f("ck_billing_invoices_kind")
        ),
        sa.CheckConstraint(
            "purpose IN ('deposit', 'balance', 'full', 'subscription', 'course', 'credit')",
            name=op.f("ck_billing_invoices_purpose"),
        ),
        sa.CheckConstraint(
            "status IN ('issued', 'paid', 'cancelled')", name=op.f("ck_billing_invoices_status")
        ),
        sa.ForeignKeyConstraint(
            ["credited_invoice_id"],
            ["billing_invoices.id"],
            name=op.f("fk_billing_invoices_credited_invoice_id_billing_invoices"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["issued_by_id"],
            ["users.id"],
            name=op.f("fk_billing_invoices_issued_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_billing_invoices_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["quote_id"],
            ["billing_quotes.id"],
            name=op.f("fk_billing_invoices_quote_id_billing_quotes"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["billing_subscriptions.id"],
            name=op.f("fk_billing_invoices_subscription_id_billing_subscriptions"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_invoices")),
        sa.UniqueConstraint("external_ref", name=op.f("uq_billing_invoices_external_ref")),
        sa.UniqueConstraint("number", name=op.f("uq_billing_invoices_number")),
    )
    op.create_index(
        "ix_billing_invoices_org_status",
        "billing_invoices",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_invoices_organization_id"),
        "billing_invoices",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "billing_quote_lines",
        sa.Column("quote_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("unit_price_cents", sa.BigInteger(), nullable=False),
        sa.Column("vat_rate_bp", sa.Integer(), nullable=False),
        sa.Column("net_cents", sa.BigInteger(), nullable=False),
        sa.Column("vat_cents", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["billing_products.id"],
            name=op.f("fk_billing_quote_lines_product_id_billing_products"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["quote_id"],
            ["billing_quotes.id"],
            name=op.f("fk_billing_quote_lines_quote_id_billing_quotes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_quote_lines")),
    )
    op.create_index(
        "ix_billing_quote_lines_quote",
        "billing_quote_lines",
        ["quote_id", "position"],
        unique=False,
    )
    op.create_table(
        "billing_checkouts",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("stripe_session_id", sa.String(length=120), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=True),
        sa.Column("product_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "purpose IN ('invoice', 'subscription', 'course')",
            name=op.f("ck_billing_checkouts_purpose"),
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["billing_invoices.id"],
            name=op.f("fk_billing_checkouts_invoice_id_billing_invoices"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_billing_checkouts_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["billing_products.id"],
            name=op.f("fk_billing_checkouts_product_id_billing_products"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_billing_checkouts_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_checkouts")),
        sa.UniqueConstraint(
            "stripe_session_id", name=op.f("uq_billing_checkouts_stripe_session_id")
        ),
    )
    op.create_index(
        op.f("ix_billing_checkouts_organization_id"),
        "billing_checkouts",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "billing_invoice_lines",
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("unit_price_cents", sa.BigInteger(), nullable=False),
        sa.Column("vat_rate_bp", sa.Integer(), nullable=False),
        sa.Column("net_cents", sa.BigInteger(), nullable=False),
        sa.Column("vat_cents", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["billing_invoices.id"],
            name=op.f("fk_billing_invoice_lines_invoice_id_billing_invoices"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_invoice_lines")),
    )
    op.create_index(
        "ix_billing_invoice_lines_invoice",
        "billing_invoice_lines",
        ["invoice_id", "position"],
        unique=False,
    )
    op.create_table(
        "billing_payments",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("provider_ref", sa.String(length=120), nullable=True),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "provider IN ('stripe', 'transfer')", name=op.f("ck_billing_payments_provider")
        ),
        sa.CheckConstraint("amount_cents > 0", name=op.f("ck_billing_payments_amount")),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["billing_invoices.id"],
            name=op.f("fk_billing_payments_invoice_id_billing_invoices"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_billing_payments_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by_id"],
            ["users.id"],
            name=op.f("fk_billing_payments_recorded_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_payments")),
        sa.UniqueConstraint("provider_ref", name=op.f("uq_billing_payments_provider_ref")),
    )
    op.create_index(
        op.f("ix_billing_payments_invoice_id"), "billing_payments", ["invoice_id"], unique=False
    )
    op.create_index(
        "ix_billing_payments_org",
        "billing_payments",
        ["organization_id", "received_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_payments_organization_id"),
        "billing_payments",
        ["organization_id"],
        unique=False,
    )
    _notification_types(NOTIFICATIONS_AFTER)


def downgrade() -> None:
    op.drop_index(op.f("ix_billing_payments_organization_id"), table_name="billing_payments")
    op.drop_index("ix_billing_payments_org", table_name="billing_payments")
    op.drop_index(op.f("ix_billing_payments_invoice_id"), table_name="billing_payments")
    op.drop_table("billing_payments")
    op.drop_index("ix_billing_invoice_lines_invoice", table_name="billing_invoice_lines")
    op.drop_table("billing_invoice_lines")
    op.drop_index(op.f("ix_billing_checkouts_organization_id"), table_name="billing_checkouts")
    op.drop_table("billing_checkouts")
    op.drop_index("ix_billing_quote_lines_quote", table_name="billing_quote_lines")
    op.drop_table("billing_quote_lines")
    op.drop_index(op.f("ix_billing_invoices_organization_id"), table_name="billing_invoices")
    op.drop_index("ix_billing_invoices_org_status", table_name="billing_invoices")
    op.drop_table("billing_invoices")
    op.drop_index(
        op.f("ix_billing_subscriptions_organization_id"), table_name="billing_subscriptions"
    )
    op.drop_index("ix_billing_subscriptions_org", table_name="billing_subscriptions")
    op.drop_table("billing_subscriptions")
    op.drop_index(op.f("ix_billing_quotes_organization_id"), table_name="billing_quotes")
    op.drop_index("ix_billing_quotes_org_status", table_name="billing_quotes")
    op.drop_table("billing_quotes")
    op.drop_index(op.f("ix_billing_products_organization_id"), table_name="billing_products")
    op.drop_table("billing_products")
    op.drop_table("billing_profiles")
    op.drop_table("billing_stripe_events")
    op.drop_table("billing_counters")
    op.execute(
        "DELETE FROM notifications WHERE type IN "
        "('quote_sent', 'invoice_issued', 'quote_accepted', 'quote_declined', 'payment_received')"
    )
    _notification_types(NOTIFICATIONS_BEFORE)
