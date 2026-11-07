"""CMS: documents, translations and media; internal organization; services content.

Creates the internal DEV4INNOVA organization (staff and back office, ADR-0006) and moves
the five services shown on the website from apps/web/messages into the CMS (EPIC 06).

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-07
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INTERNAL_ORGANIZATION_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")

# Content of the website services at the time of the migration (FR and EN).
SERVICES = [
    {
        "slug": "ai-strategy",
        "icon": "compass",
        "position": 1,
        "fr": {
            "title": "Conseil et stratégie IA",
            "summary": "Identifier les cas d'usage à forte valeur et bâtir votre feuille de route.",
            "body_md": "Nous évaluons votre maturité, vos données et vos processus pour prioriser les projets IA les plus pertinents, en tenant compte des enjeux réglementaires et éthiques.\n\n## Ce que nous livrons\n\n- Cartographie des cas d'usage\n- Analyse de faisabilité et de risques\n- Feuille de route priorisée\n\n## Pour qui ?\n\nDirections générales, métiers et DSI qui veulent structurer leur démarche IA.",
        },
        "en": {
            "title": "AI consulting and strategy",
            "summary": "Identify high-value use cases and build your roadmap.",
            "body_md": "We assess your maturity, data and processes to prioritize the most relevant AI projects, taking regulatory and ethical issues into account.\n\n## What we deliver\n\n- Use case map\n- Feasibility and risk analysis\n- Prioritized roadmap\n\n## Who is it for?\n\nExecutives, business units and IT departments who want to structure their AI approach.",
        },
    },
    {
        "slug": "custom-development",
        "icon": "hammer",
        "position": 2,
        "fr": {
            "title": "Développement sur mesure",
            "summary": "Concevoir des solutions IA adaptées à vos besoins spécifiques.",
            "body_md": "Nos équipes conçoivent et développent des applications IA robustes, testées et documentées, en s'appuyant sur les meilleurs modèles du marché.\n\n## Ce que nous livrons\n\n- Prototype et preuve de concept\n- Application prête pour la production\n- Documentation et code maintenables\n\n## Pour qui ?\n\nOrganisations dont les besoins ne sont pas couverts par des outils standards.",
        },
        "en": {
            "title": "Custom development",
            "summary": "Design AI solutions tailored to your specific needs.",
            "body_md": "Our teams design and build robust, tested and documented AI applications, using the best models available.\n\n## What we deliver\n\n- Prototype and proof of concept\n- Production-ready application\n- Maintainable code and documentation\n\n## Who is it for?\n\nOrganizations whose needs are not covered by off-the-shelf tools.",
        },
    },
    {
        "slug": "integration-deployment",
        "icon": "rocket",
        "position": 3,
        "fr": {
            "title": "Intégration et déploiement",
            "summary": "Connecter l'IA à votre système d'information et la mettre en production.",
            "body_md": "Nous intégrons les solutions à vos outils existants, sécurisons les flux de données et assurons une mise en production maîtrisée.\n\n## Ce que nous livrons\n\n- Connecteurs vers vos applications\n- Architecture sécurisée\n- Mise en production accompagnée\n\n## Pour qui ?\n\nÉquipes techniques qui veulent industrialiser un prototype ou une solution existante.",
        },
        "en": {
            "title": "Integration and deployment",
            "summary": "Connect AI to your information system and take it to production.",
            "body_md": "We integrate solutions with your existing tools, secure data flows and ensure a controlled go-live.\n\n## What we deliver\n\n- Connectors to your applications\n- Secure architecture\n- Supported go-live\n\n## Who is it for?\n\nTechnical teams who want to industrialize a prototype or an existing solution.",
        },
    },
    {
        "slug": "training-support",
        "icon": "graduation-cap",
        "position": 4,
        "fr": {
            "title": "Formation et accompagnement",
            "summary": "Donner à vos équipes les clés pour utiliser l'IA efficacement.",
            "body_md": "Formations adaptées à chaque profil, accompagnement au changement et bonnes pratiques d'usage responsable de l'IA.\n\n## Ce que nous livrons\n\n- Parcours de formation adaptés\n- Ateliers pratiques\n- Guides d'usage et bonnes pratiques\n\n## Pour qui ?\n\nCollaborateurs, managers et équipes techniques, quel que soit leur niveau.",
        },
        "en": {
            "title": "Training and change support",
            "summary": "Give your teams the keys to use AI effectively.",
            "body_md": "Training adapted to each profile, change management support and good practices for responsible AI use.\n\n## What we deliver\n\n- Tailored learning paths\n- Hands-on workshops\n- Usage guides and good practices\n\n## Who is it for?\n\nEmployees, managers and technical teams, whatever their level.",
        },
    },
    {
        "slug": "run-and-improve",
        "icon": "server-cog",
        "position": 5,
        "fr": {
            "title": "Suivi et amélioration continue",
            "summary": "Garantir la qualité et la performance de vos solutions dans la durée.",
            "body_md": "Nous surveillons la qualité des résultats, les coûts et l'usage, puis faisons évoluer les solutions au rythme de vos besoins et des progrès technologiques.\n\n## Ce que nous livrons\n\n- Suivi de la qualité et des coûts\n- Évolutions régulières\n- Support et maintenance\n\n## Pour qui ?\n\nOrganisations qui ont une solution IA en production et veulent la faire vivre.",
        },
        "en": {
            "title": "Monitoring and continuous improvement",
            "summary": "Keep your solutions accurate and efficient over time.",
            "body_md": "We monitor result quality, costs and usage, then evolve the solutions as your needs and technology progress.\n\n## What we deliver\n\n- Quality and cost monitoring\n- Regular improvements\n- Support and maintenance\n\n## Who is it for?\n\nOrganizations with an AI solution in production that they want to keep improving.",
        },
    },
]


def upgrade() -> None:
    op.create_table(
        "cms_media",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=200), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=50), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("alt_fr", sa.String(length=300), server_default="", nullable=False),
        sa.Column("alt_en", sa.String(length=300), server_default="", nullable=False),
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
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_cms_media_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_cms_media_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cms_media")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_cms_media_storage_key")),
    )
    op.create_index(
        op.f("ix_cms_media_organization_id"), "cms_media", ["organization_id"], unique=False
    )
    op.create_table(
        "cms_documents",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "attributes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("cover_media_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
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
            "status IN ('draft', 'published')", name=op.f("ck_cms_documents_status")
        ),
        sa.CheckConstraint(
            "type IN ('article', 'project', 'service', 'page')", name=op.f("ck_cms_documents_type")
        ),
        sa.ForeignKeyConstraint(
            ["cover_media_id"],
            ["cms_media.id"],
            name=op.f("fk_cms_documents_cover_media_id_cms_media"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_cms_documents_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_cms_documents_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"],
            ["users.id"],
            name=op.f("fk_cms_documents_updated_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cms_documents")),
    )
    op.create_index(
        "ix_cms_documents_org_type_status",
        "cms_documents",
        ["organization_id", "type", "status"],
        unique=False,
    )
    op.create_table(
        "cms_document_translations",
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("locale", sa.String(length=2), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.String(length=500), server_default="", nullable=False),
        sa.Column("body_md", sa.Text(), server_default="", nullable=False),
        sa.Column("seo_title", sa.String(length=70), server_default="", nullable=False),
        sa.Column("seo_description", sa.String(length=170), server_default="", nullable=False),
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
            "locale IN ('fr', 'en')", name=op.f("ck_cms_document_translations_locale")
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["cms_documents.id"],
            name=op.f("fk_cms_document_translations_document_id_cms_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_cms_document_translations_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cms_document_translations")),
        sa.UniqueConstraint(
            "document_id", "locale", name="uq_cms_document_translations_document_locale"
        ),
        sa.UniqueConstraint(
            "organization_id", "type", "locale", "slug", name="uq_cms_document_translations_slug"
        ),
    )

    organizations = sa.table(
        "organizations",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("slug", sa.String()),
        sa.column("kind", sa.String()),
    )
    op.bulk_insert(
        organizations,
        [
            {
                "id": INTERNAL_ORGANIZATION_ID,
                "name": "DEV4INNOVA",
                "slug": "dev4innova",
                "kind": "internal",
            }
        ],
    )

    documents = sa.table(
        "cms_documents",
        sa.column("id", sa.Uuid()),
        sa.column("organization_id", sa.Uuid()),
        sa.column("type", sa.String()),
        sa.column("status", sa.String()),
        sa.column("published_at", sa.DateTime(timezone=True)),
        sa.column("position", sa.Integer()),
        sa.column("attributes", postgresql.JSONB()),
    )
    translations = sa.table(
        "cms_document_translations",
        sa.column("id", sa.Uuid()),
        sa.column("document_id", sa.Uuid()),
        sa.column("organization_id", sa.Uuid()),
        sa.column("type", sa.String()),
        sa.column("locale", sa.String()),
        sa.column("slug", sa.String()),
        sa.column("title", sa.String()),
        sa.column("summary", sa.String()),
        sa.column("body_md", sa.Text()),
    )
    now = datetime.now(UTC)
    for service in SERVICES:
        document_id = uuid.uuid4()
        op.bulk_insert(
            documents,
            [
                {
                    "id": document_id,
                    "organization_id": INTERNAL_ORGANIZATION_ID,
                    "type": "service",
                    "status": "published",
                    "published_at": now,
                    "position": service["position"],
                    "attributes": {"icon": service["icon"]},
                }
            ],
        )
        op.bulk_insert(
            translations,
            [
                {
                    "id": uuid.uuid4(),
                    "document_id": document_id,
                    "organization_id": INTERNAL_ORGANIZATION_ID,
                    "type": "service",
                    "locale": locale,
                    "slug": service["slug"],
                    **service[locale],
                }
                for locale in ("fr", "en")
            ],
        )


def downgrade() -> None:
    op.drop_table("cms_document_translations")
    op.drop_index("ix_cms_documents_org_type_status", table_name="cms_documents")
    op.drop_table("cms_documents")
    op.drop_index(op.f("ix_cms_media_organization_id"), table_name="cms_media")
    op.drop_table("cms_media")
    op.execute(
        sa.text("DELETE FROM organizations WHERE id = :id").bindparams(id=INTERNAL_ORGANIZATION_ID)
    )
