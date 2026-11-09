"""Catalog (TASK-110): services used in quotes, subscriptions, paid Academy courses."""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.academy.models import Course
from app.modules.billing.common import offer, product_out, require_admin
from app.modules.billing.models import Product
from app.modules.billing.schemas import Offer, ProductIn, ProductOut
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID
from app.modules.identity.service import OrganizationContext


async def list_products(session: AsyncSession, ctx: OrganizationContext) -> list[ProductOut]:
    require_admin(ctx)
    rows = (
        await session.execute(
            select(Product, Course.slug)
            .outerjoin(Course, Course.id == Product.course_id)
            .order_by(Product.kind, Product.code)
        )
    ).all()
    return [product_out(p, slug) for p, slug in rows]


async def _apply(session: AsyncSession, product: Product, data: ProductIn) -> None:
    if data.course_id and await session.get(Course, data.course_id) is None:
        raise NotFoundError("Course not found")
    product.code = data.code
    product.kind = data.kind
    product.name = {"fr": data.name.fr, "en": data.name.en}
    product.description = {"fr": data.description.fr, "en": data.description.en}
    product.unit_price_cents = data.unit_price_cents
    product.vat_rate_bp = data.vat_rate_bp
    product.interval = data.interval
    product.course_id = data.course_id
    product.active = data.active


async def _commit(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ConflictError(
            "This code or this course is already used by another product", {"field": "code"}
        ) from error


async def create_product(
    session: AsyncSession, ctx: OrganizationContext, data: ProductIn
) -> Product:
    require_admin(ctx)
    product = Product(organization_id=INTERNAL_ORGANIZATION_ID)
    await _apply(session, product, data)
    session.add(product)
    await _commit(session)
    return product


async def update_product(
    session: AsyncSession, ctx: OrganizationContext, product_id: uuid.UUID, data: ProductIn
) -> Product:
    """Prices change for the future only: quotes and invoices keep their own copy."""
    require_admin(ctx)
    product = await session.get(Product, product_id)
    if product is None:
        raise NotFoundError("Product not found")
    if product.kind != data.kind:
        raise ConflictError("The kind of a product cannot change: create another one")
    await _apply(session, product, data)
    await _commit(session)
    return product


async def subscription_offers(session: AsyncSession, locale: str) -> list[Offer]:
    rows = await session.scalars(
        select(Product)
        .where(Product.kind == "subscription", Product.active.is_(True))
        .order_by(Product.unit_price_cents)
    )
    return [offer(p, locale) for p in rows]


async def course_product(session: AsyncSession, course_id: uuid.UUID) -> Product | None:
    """The active product of a paid course, if any."""
    return await session.scalar(
        select(Product).where(Product.course_id == course_id, Product.active.is_(True))
    )
