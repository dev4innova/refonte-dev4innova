"""Identity models: users, organizations and memberships (ADR-0006)."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.identity.permissions import ROLES

LOCALES = ("fr", "en")
ORGANIZATION_KINDS = ("client", "internal")

INTERNAL_ORGANIZATION_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
"""The DEV4INNOVA organization itself (created by migration 0004). Its members with a
staff_* role run the back office (CMS, CRM...)."""
INTERNAL_ORGANIZATION_SLUG = "dev4innova"


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A person, authenticated by the identity provider. No password is stored here."""

    __tablename__ = "users"
    __table_args__ = (CheckConstraint(f"locale IN ({_in(LOCALES)})", name="locale"),)

    external_subject: Mapped[str] = mapped_column(String(255), unique=True)
    """`sub` claim of the identity provider."""
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    """Stored lower-cased (see service.provision_user)."""
    display_name: Mapped[str | None] = mapped_column(String(200))
    locale: Mapped[str] = mapped_column(String(2), default="fr", server_default="fr")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list["Membership"]] = relationship(back_populates="user")


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A tenant. Every business record will belong to one organization."""

    __tablename__ = "organizations"
    __table_args__ = (CheckConstraint(f"kind IN ({_in(ORGANIZATION_KINDS)})", name="kind"),)

    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    kind: Mapped[str] = mapped_column(String(20), default="client", server_default="client")

    memberships: Mapped[list["Membership"]] = relationship(back_populates="organization")


class Membership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user's role inside one organization."""

    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_memberships_organization_user"),
        CheckConstraint(f"role IN ({_in(ROLES)})", name="role"),
    )

    # Indexed by the (organization_id, user_id) unique constraint, which starts with it.
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(30))

    organization: Mapped[Organization] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")
