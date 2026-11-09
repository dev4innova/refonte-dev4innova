"""Invoices, credit notes and payments (TASK-112, TASK-113, TASK-115).

An invoice is issued with its final number (gapless series per year), the seller and customer
details and its lines copied: it never changes afterwards, except what is paid. A mistake is
corrected by a credit note, which cancels the invoice.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError
from app.modules.billing import common
from app.modules.billing.common import now, require_admin, scope, today
from app.modules.billing.models import Invoice, InvoiceLine, Payment, Quote
from app.modules.billing.money import line_amounts
from app.modules.billing.numbering import next_number
from app.modules.billing.schemas import (
    CreditNoteIn,
    InvoiceOut,
    InvoicePage,
    InvoiceSummary,
    LineOut,
    PaymentOut,
    TransferIn,
)
from app.modules.identity.service import OrganizationContext
from app.modules.portal import access as notifications


@dataclass(frozen=True)
class Line:
    description: str
    quantity: Decimal
    unit_price_cents: int
    vat_rate_bp: int


async def issue(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    purpose: str,
    title: str,
    lines: list[Line],
    issued_by: uuid.UUID | None = None,
    quote_id: uuid.UUID | None = None,
    subscription_id: uuid.UUID | None = None,
    external_ref: str | None = None,
    credited: Invoice | None = None,
    due_now: bool = False,
) -> Invoice:
    """Issues an invoice (or a credit note when `credited` is given) in the current transaction."""
    customer = credited.customer if credited else await common.customer(session, organization_id)
    issued_on = today()
    kind = "credit_note" if credited else "invoice"
    invoice = Invoice(
        organization_id=organization_id,
        number=await next_number(session, "A" if credited else "F", issued_on.year),
        kind=kind,
        status="issued",
        purpose=purpose,
        title=title,
        issue_date=issued_on,
        due_date=issued_on
        if due_now or credited
        else issued_on + timedelta(days=get_settings().billing_payment_terms_days),
        seller=credited.seller if credited else common.seller(),
        customer=customer,
        net_cents=0,
        vat_cents=0,
        gross_cents=0,
        quote_id=quote_id,
        subscription_id=subscription_id,
        credited_invoice_id=credited.id if credited else None,
        issued_by_id=issued_by,
        external_ref=external_ref,
    )
    session.add(invoice)
    await session.flush()
    for position, line in enumerate(lines):
        amounts = line_amounts(line.quantity, line.unit_price_cents, line.vat_rate_bp)
        sign = -1 if credited else 1
        session.add(
            InvoiceLine(
                invoice_id=invoice.id,
                position=position,
                description=line.description,
                quantity=line.quantity,
                unit_price_cents=line.unit_price_cents * sign,
                vat_rate_bp=line.vat_rate_bp,
                net_cents=amounts.net_cents * sign,
                vat_cents=amounts.vat_cents * sign,
            )
        )
        invoice.net_cents += amounts.net_cents * sign
        invoice.vat_cents += amounts.vat_cents * sign
    invoice.gross_cents = invoice.net_cents + invoice.vat_cents
    await session.flush()
    if not credited:
        await notifications.notify_members(
            session,
            organization_id,
            "invoice_issued",
            {
                "invoice_id": str(invoice.id),
                "number": invoice.number,
                "amount_cents": invoice.gross_cents,
            },
        )
    return invoice


async def record_payment(
    session: AsyncSession,
    invoice: Invoice,
    *,
    provider: str,
    amount_cents: int,
    provider_ref: str | None,
    received_at: datetime,
    recorded_by: uuid.UUID | None = None,
    notify: bool = True,
) -> Payment | None:
    """Adds a payment to an invoice (idempotent on the provider reference)."""
    if provider_ref and await session.scalar(
        select(Payment.id).where(Payment.provider_ref == provider_ref)
    ):
        return None
    payment = Payment(
        organization_id=invoice.organization_id,
        invoice_id=invoice.id,
        provider=provider,
        provider_ref=provider_ref,
        amount_cents=amount_cents,
        received_at=received_at,
        recorded_by_id=recorded_by,
    )
    session.add(payment)
    invoice.paid_cents += amount_cents
    if invoice.paid_cents >= invoice.gross_cents and invoice.status == "issued":
        invoice.status = "paid"
        invoice.paid_at = received_at
    await session.flush()
    if notify:
        await notifications.notify_staff(
            session,
            invoice.organization_id,
            "payment_received",
            {"invoice_id": str(invoice.id), "number": invoice.number, "amount_cents": amount_cents},
        )
    return payment


# --- Reading ---------------------------------------------------------------------------


def _due(invoice: Invoice) -> int:
    if invoice.kind == "credit_note" or invoice.status == "cancelled":
        return 0
    return max(invoice.gross_cents - invoice.paid_cents, 0)


async def summaries(session: AsyncSession, invoices: list[Invoice]) -> list[InvoiceSummary]:
    orgs = await common.organizations(session, [i.organization_id for i in invoices])
    day = today()
    return [
        InvoiceSummary(
            id=i.id,
            number=i.number,
            kind=i.kind,
            status=i.status,
            purpose=i.purpose,
            title=i.title,
            organization=orgs[i.organization_id],
            issue_date=i.issue_date,
            due_date=i.due_date,
            gross_cents=i.gross_cents,
            paid_cents=i.paid_cents,
            due_cents=_due(i),
            overdue=_due(i) > 0 and i.due_date < day,
        )
        for i in invoices
    ]


async def payments_out(session: AsyncSession, payments: list[Payment]) -> list[PaymentOut]:
    numbers = (
        dict(
            (
                await session.execute(
                    select(Invoice.id, Invoice.number).where(
                        Invoice.id.in_({p.invoice_id for p in payments})
                    )
                )
            ).all()
        )
        if payments
        else {}
    )
    orgs = await common.organizations(session, [p.organization_id for p in payments])
    return [
        PaymentOut(
            id=p.id,
            invoice_id=p.invoice_id,
            invoice_number=numbers[p.invoice_id],
            organization=orgs[p.organization_id],
            provider=p.provider,
            provider_ref=p.provider_ref,
            amount_cents=p.amount_cents,
            received_at=p.received_at,
        )
        for p in payments
    ]


async def list_invoices(
    session: AsyncSession,
    ctx: OrganizationContext,
    *,
    organization_id: uuid.UUID | None = None,
    open_only: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> InvoicePage:
    limited = scope(ctx)
    query = select(Invoice)
    if limited:
        query = query.where(Invoice.organization_id == limited)
    elif organization_id:
        query = query.where(Invoice.organization_id == organization_id)
    if open_only:
        query = query.where(Invoice.kind == "invoice", Invoice.status == "issued")
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(
        await session.scalars(
            query.order_by(Invoice.issue_date.desc(), Invoice.number.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return InvoicePage(items=await summaries(session, rows), total=total)


async def get_invoice(
    session: AsyncSession, ctx: OrganizationContext, invoice_id: uuid.UUID
) -> Invoice:
    limited = scope(ctx)
    query = select(Invoice).where(Invoice.id == invoice_id)
    if limited:
        query = query.where(Invoice.organization_id == limited)
    invoice = await session.scalar(query)
    if invoice is None:
        raise NotFoundError("Invoice not found")
    return invoice


def payment_reference(invoice: Invoice) -> str:
    """Reference to write on a bank transfer."""
    return invoice.number


async def invoice_out(session: AsyncSession, invoice: Invoice) -> InvoiceOut:
    lines = list(
        await session.scalars(
            select(InvoiceLine)
            .where(InvoiceLine.invoice_id == invoice.id)
            .order_by(InvoiceLine.position)
        )
    )
    payments = list(
        await session.scalars(
            select(Payment).where(Payment.invoice_id == invoice.id).order_by(Payment.received_at)
        )
    )
    quote_number = (
        await session.scalar(select(Quote.number).where(Quote.id == invoice.quote_id))
        if invoice.quote_id
        else None
    )
    credited = (
        await session.scalar(
            select(Invoice.number).where(Invoice.id == invoice.credited_invoice_id)
        )
        if invoice.credited_invoice_id
        else None
    )
    credit_note = await session.scalar(
        select(Invoice.number).where(Invoice.credited_invoice_id == invoice.id)
    )
    breakdown: dict[int, dict[str, int]] = defaultdict(lambda: {"net_cents": 0, "vat_cents": 0})
    for line in lines:
        breakdown[line.vat_rate_bp]["net_cents"] += line.net_cents
        breakdown[line.vat_rate_bp]["vat_cents"] += line.vat_cents
    (summary,) = await summaries(session, [invoice])
    return InvoiceOut(
        **summary.model_dump(),
        net_cents=invoice.net_cents,
        vat_cents=invoice.vat_cents,
        vat_breakdown=[
            {"vat_rate_bp": rate, **values} for rate, values in sorted(breakdown.items())
        ],
        lines=[
            LineOut(
                description=line.description,
                quantity=line.quantity,
                unit_price_cents=line.unit_price_cents,
                vat_rate_bp=line.vat_rate_bp,
                net_cents=line.net_cents,
                vat_cents=line.vat_cents,
            )
            for line in lines
        ],
        seller=invoice.seller,
        customer=invoice.customer,
        payments=await payments_out(session, payments),
        quote_number=quote_number,
        credited_invoice_number=credited,
        credit_note_number=credit_note,
        payment_reference=payment_reference(invoice),
        can_pay_online=summary.due_cents > 0,
    )


# --- Team actions ------------------------------------------------------------------------


async def credit(
    session: AsyncSession, ctx: OrganizationContext, invoice_id: uuid.UUID, data: CreditNoteIn
) -> Invoice:
    """Credit note for the whole invoice, which is then cancelled (refunds go through the
    payment provider or a bank transfer, outside the platform)."""
    require_admin(ctx)
    invoice = await get_invoice(session, ctx, invoice_id)
    if invoice.kind != "invoice" or invoice.status == "cancelled":
        raise ConflictError("Only an invoice that is not already cancelled can be credited")
    lines = list(
        await session.scalars(
            select(InvoiceLine)
            .where(InvoiceLine.invoice_id == invoice.id)
            .order_by(InvoiceLine.position)
        )
    )
    note = await issue(
        session,
        organization_id=invoice.organization_id,
        purpose="credit",
        title=f"{data.reason} ({invoice.number})",
        lines=[
            Line(line.description, line.quantity, line.unit_price_cents, line.vat_rate_bp)
            for line in lines
        ],
        issued_by=ctx.user.id,
        quote_id=invoice.quote_id,
        credited=invoice,
    )
    invoice.status = "cancelled"
    await session.commit()
    return note


async def record_transfer(
    session: AsyncSession, ctx: OrganizationContext, invoice_id: uuid.UUID, data: TransferIn
) -> Invoice:
    require_admin(ctx)
    invoice = await get_invoice(session, ctx, invoice_id)
    if _due(invoice) <= 0:
        raise ConflictError("Nothing is due on this invoice")
    if data.amount_cents > _due(invoice):
        raise ConflictError("The amount is more than what is due", {"due_cents": _due(invoice)})
    reference = f"transfer:{data.reference}" if data.reference else None
    if reference and await session.scalar(
        select(Payment.id).where(Payment.provider_ref == reference)
    ):
        raise ConflictError("This transfer reference is already recorded")
    try:
        await record_payment(
            session,
            invoice,
            provider="transfer",
            amount_cents=data.amount_cents,
            provider_ref=reference,
            received_at=datetime.combine(
                data.received_on, datetime.min.time(), tzinfo=now().tzinfo
            ),
            recorded_by=ctx.user.id,
            notify=False,
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ConflictError("This transfer reference is already recorded") from error
    return invoice


async def list_payments(
    session: AsyncSession,
    ctx: OrganizationContext,
    *,
    organization_id: uuid.UUID | None = None,
    limit: int = 200,
) -> list[PaymentOut]:
    limited = scope(ctx)
    query = select(Payment)
    if limited:
        query = query.where(Payment.organization_id == limited)
    elif organization_id:
        query = query.where(Payment.organization_id == organization_id)
    rows = list(await session.scalars(query.order_by(Payment.received_at.desc()).limit(limit)))
    return await payments_out(session, rows)


def vat_label(rate_bp: int) -> str:
    return f"{rate_bp / 100:g} %".replace(".", ",")
