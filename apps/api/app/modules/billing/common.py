"""Shared helpers of billing: access, organizations, seller and customer details."""

import uuid
from collections.abc import Iterable
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.modules.billing.models import BillingProfile, Product
from app.modules.billing.money import line_amounts
from app.modules.billing.schemas import BillingOrganization, Offer, ProductOut
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID, Organization
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext


class ProfileRequiredError(AppError):
    status_code = 409
    code = "billing_profile_required"


def now() -> datetime:
    return datetime.now(UTC)


def today() -> date:
    return now().date()


def is_staff(ctx: OrganizationContext) -> bool:
    return ctx.organization_id == INTERNAL_ORGANIZATION_ID


def require_admin(ctx: OrganizationContext) -> None:
    ctx.require(Permission.BILLING_ADMIN)


def require_client(ctx: OrganizationContext) -> None:
    """Owners and admins of a client organization."""
    if is_staff(ctx):
        raise NotFoundError("Not found")
    ctx.require(Permission.BILLING_MANAGE)


def scope(ctx: OrganizationContext) -> uuid.UUID | None:
    """The organization a query must be limited to: the client's own, or none for staff."""
    if is_staff(ctx):
        require_admin(ctx)
        return None
    require_client(ctx)
    return ctx.organization_id


async def organizations(
    session: AsyncSession, ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, BillingOrganization]:
    wanted = set(ids)
    if not wanted:
        return {}
    rows = await session.scalars(select(Organization).where(Organization.id.in_(wanted)))
    return {o.id: BillingOrganization(id=o.id, name=o.name, slug=o.slug) for o in rows}


async def client_organization(session: AsyncSession, organization_id: uuid.UUID) -> Organization:
    organization = await session.get(Organization, organization_id)
    if organization is None or organization.kind != "client":
        raise NotFoundError("Client organization not found")
    return organization


def seller() -> dict[str, Any]:
    s = get_settings()
    return {
        "name": s.billing_seller_name,
        "legal_form": s.billing_seller_legal_form,
        "address": s.billing_seller_address,
        "siren": s.billing_seller_siren,
        "vat_number": s.billing_seller_vat_number,
        "iban": s.billing_seller_iban,
        "bic": s.billing_seller_bic,
        "email": s.billing_seller_email,
    }


async def profile(session: AsyncSession, organization_id: uuid.UUID) -> BillingProfile | None:
    return await session.scalar(
        select(BillingProfile).where(BillingProfile.organization_id == organization_id)
    )


async def customer(session: AsyncSession, organization_id: uuid.UUID) -> dict[str, Any]:
    """Customer details copied onto an invoice; a billing profile is required."""
    found = await profile(session, organization_id)
    if found is None:
        raise ProfileRequiredError("Fill in the billing details of the organization first")
    return {
        "legal_name": found.legal_name,
        "address": found.address,
        "postal_code": found.postal_code,
        "city": found.city,
        "country": found.country,
        "vat_number": found.vat_number,
        "siren": found.siren,
        "email": found.email,
    }


def gross(product: Product) -> int:
    amounts = line_amounts(Decimal(1), product.unit_price_cents, product.vat_rate_bp)
    return amounts.net_cents + amounts.vat_cents


def text(value: dict[str, Any], locale: str) -> str:
    return str(value.get(locale) or value.get("fr") or "")


def offer(product: Product, locale: str) -> Offer:
    return Offer(
        id=product.id,
        kind=product.kind,
        name=text(product.name, locale),
        description=text(product.description, locale),
        unit_price_cents=product.unit_price_cents,
        vat_rate_bp=product.vat_rate_bp,
        gross_cents=gross(product),
        interval=product.interval,
    )


def product_out(product: Product, course_slug: str | None = None) -> ProductOut:
    return ProductOut(
        id=product.id,
        code=product.code,
        kind=product.kind,
        name=product.name,
        description=product.description,
        unit_price_cents=product.unit_price_cents,
        vat_rate_bp=product.vat_rate_bp,
        gross_cents=gross(product),
        interval=product.interval,
        course_id=product.course_id,
        course_slug=course_slug,
        active=product.active,
    )
