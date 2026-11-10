"""Billing details of a client and the overviews (client portal, back office)."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.billing import catalog, checkout, common, invoices, quotes
from app.modules.billing.common import require_admin, require_client, today
from app.modules.billing.models import BillingProfile, Invoice, Product, Quote, Subscription
from app.modules.billing.schemas import AdminBilling, ClientBilling, ProfileIn, ProfileOut
from app.modules.identity.service import OrganizationContext


def _profile_out(profile: BillingProfile) -> ProfileOut:
    return ProfileOut(
        organization_id=profile.organization_id,
        legal_name=profile.legal_name,
        address=profile.address,
        postal_code=profile.postal_code,
        city=profile.city,
        country=profile.country,
        vat_number=profile.vat_number,
        siren=profile.siren,
        email=profile.email,
    )


async def save_profile(
    session: AsyncSession, ctx: OrganizationContext, data: ProfileIn
) -> ProfileOut:
    """Billing details of the organization; invoices already issued keep their own copy."""
    require_client(ctx)
    profile = await common.profile(session, ctx.organization_id)
    if profile is None:
        profile = BillingProfile(organization_id=ctx.organization_id, **data.model_dump())
        session.add(profile)
    else:
        for field, value in data.model_dump().items():
            setattr(profile, field, value)
    await session.commit()
    return _profile_out(profile)


async def client_billing(
    session: AsyncSession, ctx: OrganizationContext, locale: str
) -> ClientBilling:
    require_client(ctx)
    org = ctx.organization_id
    profile = await common.profile(session, org)
    quote_rows = list(
        await session.scalars(
            select(Quote)
            .where(Quote.organization_id == org, Quote.status != "draft")
            .order_by(Quote.created_at.desc())
            .limit(20)
        )
    )
    invoice_rows = list(
        await session.scalars(
            select(Invoice)
            .where(Invoice.organization_id == org)
            .order_by(Invoice.issue_date.desc(), Invoice.number.desc())
            .limit(50)
        )
    )
    subscription_rows = list(
        await session.scalars(
            select(Subscription)
            .where(Subscription.organization_id == org, Subscription.status != "incomplete")
            .order_by(Subscription.created_at.desc())
        )
    )
    invoice_list = await invoices.summaries(session, invoice_rows)
    settings = get_settings()
    return ClientBilling(
        profile=_profile_out(profile) if profile else None,
        quotes=await quotes.summaries(session, quote_rows),
        invoices=invoice_list,
        subscriptions=await checkout.subscriptions_out(session, subscription_rows, locale),
        offers=await catalog.subscription_offers(session, locale),
        due_cents=sum(i.due_cents for i in invoice_list),
        online_payment=settings.online_payments,
    )


async def admin_billing(session: AsyncSession, ctx: OrganizationContext) -> AdminBilling:
    require_admin(ctx)
    day = today()
    open_invoices = list(
        await session.scalars(
            select(Invoice)
            .where(Invoice.kind == "invoice", Invoice.status == "issued")
            .order_by(Invoice.due_date)
        )
    )
    due = [(i, i.gross_cents - i.paid_cents) for i in open_invoices]
    overdue = [(i, amount) for i, amount in due if i.due_date < day and amount > 0]
    month_start = day.replace(day=1)
    accepted = await session.scalar(
        select(func.coalesce(func.sum(Quote.gross_cents), 0)).where(
            Quote.status == "accepted", Quote.accepted_at >= month_start
        )
    )
    running = (
        await session.execute(
            select(Product.unit_price_cents, Product.vat_rate_bp, Product.interval)
            .join(Subscription, Subscription.product_id == Product.id)
            .where(Subscription.status.in_(("active", "past_due")))
        )
    ).all()
    monthly = 0
    for price, rate, interval in running:
        amount = price + round(price * rate / 10_000)
        monthly += amount if interval == "month" else round(amount / 12)
    awaiting = list(
        await session.scalars(
            select(Quote).where(Quote.status == "sent").order_by(Quote.valid_until).limit(10)
        )
    )
    return AdminBilling(
        receivable_cents=sum(amount for _, amount in due),
        overdue_cents=sum(amount for _, amount in overdue),
        overdue_invoices=len(overdue),
        quotes_awaiting=await session.scalar(
            select(func.count()).select_from(Quote).where(Quote.status == "sent")
        )
        or 0,
        accepted_this_month_cents=int(accepted or 0),
        monthly_recurring_cents=monthly,
        invoices=await invoices.summaries(session, [i for i, _ in due][:10]),
        quotes=await quotes.summaries(session, awaiting),
    )
