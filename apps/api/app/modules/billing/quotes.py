"""Quotes (TASK-111): written by the team, accepted or declined online by the client's owners
and admins. Acceptance issues the first invoice: a deposit, or the whole amount."""

import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.billing import common, invoices
from app.modules.billing.common import now, require_admin, require_client, scope, today
from app.modules.billing.invoices import Line
from app.modules.billing.models import Invoice, InvoiceLine, Product, Quote, QuoteLine
from app.modules.billing.money import line_amounts, share
from app.modules.billing.numbering import next_number
from app.modules.billing.schemas import (
    Acceptance,
    Decline,
    LineOut,
    QuoteCreate,
    QuoteIn,
    QuoteOut,
    QuotePage,
    QuoteSummary,
)
from app.modules.crm.models import Opportunity
from app.modules.identity.service import OrganizationContext
from app.modules.portal import access as notifications


def _expired(quote: Quote) -> bool:
    return quote.status == "sent" and quote.valid_until < today()


async def summaries(session: AsyncSession, quotes: list[Quote]) -> list[QuoteSummary]:
    orgs = await common.organizations(session, [q.organization_id for q in quotes])
    return [
        QuoteSummary(
            id=q.id,
            number=q.number,
            status=q.status,
            title=q.title,
            organization=orgs[q.organization_id],
            valid_until=q.valid_until,
            expired=_expired(q),
            gross_cents=q.gross_cents,
            sent_at=q.sent_at,
            accepted_at=q.accepted_at,
        )
        for q in quotes
    ]


async def _invoiced(session: AsyncSession, quote_id: uuid.UUID) -> list[Invoice]:
    return list(
        await session.scalars(
            select(Invoice)
            .where(
                Invoice.quote_id == quote_id,
                Invoice.kind == "invoice",
                Invoice.status != "cancelled",
            )
            .order_by(Invoice.issue_date, Invoice.number)
        )
    )


async def quote_out(session: AsyncSession, quote: Quote) -> QuoteOut:
    lines = list(
        await session.scalars(
            select(QuoteLine).where(QuoteLine.quote_id == quote.id).order_by(QuoteLine.position)
        )
    )
    invoiced = await _invoiced(session, quote.id)
    all_invoices = list(
        await session.scalars(
            select(Invoice).where(Invoice.quote_id == quote.id).order_by(Invoice.number)
        )
    )
    (summary,) = await summaries(session, [quote])
    return QuoteOut(
        **summary.model_dump(),
        notes=quote.notes,
        deposit_percent=quote.deposit_percent,
        net_cents=quote.net_cents,
        vat_cents=quote.vat_cents,
        lines=[
            LineOut(
                description=line.description,
                quantity=line.quantity,
                unit_price_cents=line.unit_price_cents,
                vat_rate_bp=line.vat_rate_bp,
                net_cents=line.net_cents,
                vat_cents=line.vat_cents,
                product_id=line.product_id,
            )
            for line in lines
        ],
        acceptance_name=quote.acceptance_name,
        declined_at=quote.declined_at,
        decline_reason=quote.decline_reason,
        invoices=await invoices.summaries(session, all_invoices),
        remaining_to_invoice_cents=(quote.gross_cents - sum(i.gross_cents for i in invoiced))
        if quote.status == "accepted"
        else 0,
        opportunity_id=quote.opportunity_id,
    )


async def list_quotes(
    session: AsyncSession, ctx: OrganizationContext, *, organization_id: uuid.UUID | None = None
) -> QuotePage:
    limited = scope(ctx)
    query = select(Quote)
    if limited:
        # Clients never see drafts.
        query = query.where(Quote.organization_id == limited, Quote.status != "draft")
    elif organization_id:
        query = query.where(Quote.organization_id == organization_id)
    rows = list(await session.scalars(query.order_by(Quote.created_at.desc()).limit(200)))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    return QuotePage(items=await summaries(session, rows), total=total)


async def get_quote(session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID) -> Quote:
    limited = scope(ctx)
    query = select(Quote).where(Quote.id == quote_id)
    if limited:
        query = query.where(Quote.organization_id == limited, Quote.status != "draft")
    quote = await session.scalar(query)
    if quote is None:
        raise NotFoundError("Quote not found")
    return quote


async def _set_lines(session: AsyncSession, quote: Quote, data: QuoteIn) -> None:
    product_ids = {line.product_id for line in data.lines if line.product_id}
    if product_ids:
        found = set(await session.scalars(select(Product.id).where(Product.id.in_(product_ids))))
        if found != product_ids:
            raise NotFoundError("Product not found")
    for old in list(await session.scalars(select(QuoteLine).where(QuoteLine.quote_id == quote.id))):
        await session.delete(old)
    quote.net_cents = quote.vat_cents = 0
    for position, line in enumerate(data.lines):
        amounts = line_amounts(line.quantity, line.unit_price_cents, line.vat_rate_bp)
        session.add(
            QuoteLine(
                quote_id=quote.id,
                position=position,
                product_id=line.product_id,
                description=line.description,
                quantity=line.quantity,
                unit_price_cents=line.unit_price_cents,
                vat_rate_bp=line.vat_rate_bp,
                net_cents=amounts.net_cents,
                vat_cents=amounts.vat_cents,
            )
        )
        quote.net_cents += amounts.net_cents
        quote.vat_cents += amounts.vat_cents
    quote.gross_cents = quote.net_cents + quote.vat_cents


async def _check_opportunity(session: AsyncSession, opportunity_id: uuid.UUID | None) -> None:
    if opportunity_id and await session.get(Opportunity, opportunity_id) is None:
        raise NotFoundError("Opportunity not found")


async def create_quote(session: AsyncSession, ctx: OrganizationContext, data: QuoteCreate) -> Quote:
    require_admin(ctx)
    await common.client_organization(session, data.organization_id)
    await _check_opportunity(session, data.opportunity_id)
    quote = Quote(
        organization_id=data.organization_id,
        number=await next_number(session, "D", today().year),
        title=data.title,
        notes=data.notes,
        valid_until=data.valid_until,
        deposit_percent=data.deposit_percent,
        opportunity_id=data.opportunity_id,
        created_by_id=ctx.user.id,
    )
    session.add(quote)
    await session.flush()
    await _set_lines(session, quote, data)
    await session.commit()
    return quote


async def update_quote(
    session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID, data: QuoteIn
) -> Quote:
    require_admin(ctx)
    quote = await get_quote(session, ctx, quote_id)
    if quote.status != "draft":
        raise ConflictError("Only a draft quote can be changed")
    await _check_opportunity(session, data.opportunity_id)
    quote.title, quote.notes, quote.valid_until = data.title, data.notes, data.valid_until
    quote.deposit_percent, quote.opportunity_id = data.deposit_percent, data.opportunity_id
    await _set_lines(session, quote, data)
    await session.commit()
    return quote


def _payload(quote: Quote, **extra: object) -> dict[str, object]:
    return {"quote_id": str(quote.id), "number": quote.number, "title": quote.title} | extra


async def send_quote(session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID) -> Quote:
    require_admin(ctx)
    quote = await get_quote(session, ctx, quote_id)
    if quote.status != "draft":
        raise ConflictError("This quote has already been sent")
    if quote.valid_until < today():
        raise ConflictError("The validity date is in the past")
    quote.status = "sent"
    quote.sent_at = now()
    await notifications.notify_members(
        session,
        quote.organization_id,
        "quote_sent",
        _payload(quote, amount_cents=quote.gross_cents),
    )
    await session.commit()
    return quote


async def cancel_quote(
    session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID
) -> Quote:
    require_admin(ctx)
    quote = await get_quote(session, ctx, quote_id)
    if quote.status not in ("draft", "sent"):
        raise ConflictError("Only a draft or sent quote can be cancelled")
    quote.status = "cancelled"
    await session.commit()
    return quote


def _by_rate(lines: list[QuoteLine]) -> dict[int, int]:
    nets: dict[int, int] = defaultdict(int)
    for line in lines:
        nets[line.vat_rate_bp] += line.net_cents
    return dict(sorted(nets.items()))


async def accept(
    session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID, data: Acceptance
) -> Invoice:
    """Online acceptance ("bon pour accord"): the typed name and the time are kept, and the
    first invoice is issued (deposit, or the full amount)."""
    require_client(ctx)
    quote = await get_quote(session, ctx, quote_id)
    if quote.status != "sent":
        raise ConflictError("This quote cannot be accepted")
    if _expired(quote):
        raise ConflictError("This quote has expired", {"reason": "expired"})
    await common.customer(session, quote.organization_id)  # billing details required
    quote.status = "accepted"
    quote.accepted_at = now()
    quote.accepted_by_id = ctx.user.id
    quote.acceptance_name = data.name
    lines = list(
        await session.scalars(
            select(QuoteLine).where(QuoteLine.quote_id == quote.id).order_by(QuoteLine.position)
        )
    )
    if quote.deposit_percent and quote.deposit_percent < 100:
        invoice = await invoices.issue(
            session,
            organization_id=quote.organization_id,
            purpose="deposit",
            title=f"{quote.title} – acompte {quote.deposit_percent} % (devis {quote.number})",
            lines=[
                Line(
                    f"Acompte {quote.deposit_percent} % sur le devis {quote.number}"
                    f" (TVA {invoices.vat_label(rate)})",
                    Decimal(1),
                    share(net, quote.deposit_percent),
                    rate,
                )
                for rate, net in _by_rate(lines).items()
            ],
            quote_id=quote.id,
            due_now=True,
        )
    else:
        invoice = await invoices.issue(
            session,
            organization_id=quote.organization_id,
            purpose="full",
            title=f"{quote.title} (devis {quote.number})",
            lines=[
                Line(line.description, line.quantity, line.unit_price_cents, line.vat_rate_bp)
                for line in lines
            ],
            quote_id=quote.id,
        )
    await notifications.notify_staff(
        session,
        quote.organization_id,
        "quote_accepted",
        _payload(quote, organization=ctx.organization.name, invoice=invoice.number),
    )
    await session.commit()
    return invoice


async def decline(
    session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID, data: Decline
) -> Quote:
    require_client(ctx)
    quote = await get_quote(session, ctx, quote_id)
    if quote.status != "sent":
        raise ConflictError("This quote cannot be declined")
    quote.status = "declined"
    quote.declined_at = now()
    quote.decline_reason = data.reason
    await notifications.notify_staff(
        session,
        quote.organization_id,
        "quote_declined",
        _payload(quote, organization=ctx.organization.name),
    )
    await session.commit()
    return quote


async def invoice_balance(
    session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID
) -> Invoice:
    """Balance invoice of an accepted quote: every line, minus the deposits already invoiced."""
    require_admin(ctx)
    quote = await get_quote(session, ctx, quote_id)
    if quote.status != "accepted":
        raise ConflictError("The quote is not accepted")
    invoiced = await _invoiced(session, quote.id)
    if any(i.purpose in ("full", "balance") for i in invoiced):
        raise ConflictError("The quote is already fully invoiced")
    lines = list(
        await session.scalars(
            select(QuoteLine).where(QuoteLine.quote_id == quote.id).order_by(QuoteLine.position)
        )
    )
    deposit_lines: list[Line] = []
    for deposit in invoiced:
        rows = await session.scalars(
            select(InvoiceLine).where(InvoiceLine.invoice_id == deposit.id)
        )
        deposit_lines += [
            Line(
                f"Acompte déjà facturé ({deposit.number})",
                Decimal(1),
                -row.unit_price_cents,
                row.vat_rate_bp,
            )
            for row in rows
        ]
    invoice = await invoices.issue(
        session,
        organization_id=quote.organization_id,
        purpose="balance",
        title=f"{quote.title} – solde (devis {quote.number})",
        lines=[
            Line(line.description, line.quantity, line.unit_price_cents, line.vat_rate_bp)
            for line in lines
        ]
        + deposit_lines,
        issued_by=ctx.user.id,
        quote_id=quote.id,
    )
    await session.commit()
    return invoice
