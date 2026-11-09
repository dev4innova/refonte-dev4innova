import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Request, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError, ServiceUnavailableError
from app.db.session import get_session
from app.modules.billing import catalog, checkout, common, document_pdf, invoices, overview, quotes
from app.modules.billing.models import Invoice, Quote, QuoteLine
from app.modules.billing.money import euros
from app.modules.billing.schemas import (
    Acceptance,
    AdminBilling,
    BillingOrganization,
    CancelIn,
    CheckoutOut,
    ClientBilling,
    CourseCheckoutIn,
    CourseOffer,
    CreditNoteIn,
    Decline,
    InvoiceOut,
    InvoicePage,
    Locale,
    PaymentOut,
    ProductIn,
    ProductOut,
    ProfileIn,
    ProfileOut,
    QuoteCreate,
    QuoteIn,
    QuoteOut,
    QuotePage,
    SubscribeIn,
    SubscriptionOut,
    TransferIn,
)
from app.modules.billing.stripe import (
    SimulatedStripeGateway,
    StripeGateway,
    get_stripe,
    verify_signature,
)
from app.modules.identity.dependencies import CurrentUser, OrgContext, StaffContext
from app.modules.identity.models import Organization

Session = Annotated[AsyncSession, Depends(get_session)]
Stripe = Annotated[StripeGateway, Depends(get_stripe)]
LocaleQuery = Annotated[Locale, Query()]

ERRORS: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing or invalid access token"},
    403: {"description": "Owners and admins only (or the staff role does not allow it)"},
    404: {"description": "Not found, or not a member of the organization"},
    409: {"description": "Not possible in the current state (details.reason)"},
}

router = APIRouter(
    prefix="/organizations/{organization_id}/billing", tags=["billing"], responses=ERRORS
)
public_router = APIRouter(prefix="/billing", tags=["billing"])
learner_router = APIRouter(prefix="/me/billing", tags=["billing"], responses=ERRORS)
admin_router = APIRouter(prefix="/admin/billing", tags=["billing-admin"], responses=ERRORS)

PDF: dict[int | str, dict[str, Any]] = {200: {"content": {"application/pdf": {}}}}

MENTIONS = [
    "En cas de retard de paiement, des pénalités sont exigibles au taux de trois fois le taux "
    "d'intérêt légal, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € "
    "(articles L441-10 et D441-5 du Code de commerce) pour les clients professionnels.",
    "Pas d'escompte pour paiement anticipé.",
]


def _pdf(content: bytes, name: str) -> Response:
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{name}.pdf"',
            "Cache-Control": "private, no-store",
        },
    )


def _date(value: Any) -> str:
    return str(value.strftime("%d/%m/%Y"))


async def _invoice_pdf(session: AsyncSession, invoice: Invoice) -> Response:
    out = await invoices.invoice_out(session, invoice)
    dates = [("Date d'émission", _date(out.issue_date))]
    paragraphs: list[str] = []
    if invoice.kind == "invoice":
        dates.append(("Date d'échéance", _date(out.due_date)))
        if out.quote_number:
            dates.append(("Devis", out.quote_number))
        if out.due_cents > 0 and invoice.seller.get("iban"):
            paragraphs.append(
                f"Paiement par virement : IBAN {invoice.seller['iban']} – BIC {invoice.seller.get('bic', '')} – "
                f"référence {out.payment_reference}, ou en ligne depuis votre espace client."
            )
    else:
        dates.append(("Avoir sur la facture", out.credited_invoice_number or ""))
    extra = (
        [
            ["Déjà payé", euros(out.paid_cents)],
            ["Reste à payer", euros(out.due_cents)],
        ]
        if invoice.kind == "invoice"
        else []
    )
    content = document_pdf.render(
        {
            "kind": invoice.kind,
            "number": invoice.number,
            "title": invoice.title,
            "dates": dates,
            "seller": invoice.seller,
            "customer": invoice.customer,
            "lines": [line.model_dump() for line in out.lines],
            "net_cents": out.net_cents,
            "vat_breakdown": out.vat_breakdown,
            "gross_cents": out.gross_cents,
            "extra_totals": extra,
            "paragraphs": paragraphs,
            "mentions": MENTIONS if invoice.kind == "invoice" else [],
        }
    )
    return _pdf(content, invoice.number)


async def _quote_pdf(session: AsyncSession, quote: Quote) -> Response:
    lines = list(
        await session.scalars(
            select(QuoteLine).where(QuoteLine.quote_id == quote.id).order_by(QuoteLine.position)
        )
    )
    organization = await session.get(Organization, quote.organization_id)
    profile = await common.profile(session, quote.organization_id)
    customer = (
        (await common.customer(session, quote.organization_id))
        if profile
        else {"legal_name": organization.name if organization else ""}
    )
    breakdown: dict[int, dict[str, int]] = {}
    for line in lines:
        entry = breakdown.setdefault(
            line.vat_rate_bp, {"vat_rate_bp": line.vat_rate_bp, "net_cents": 0, "vat_cents": 0}
        )
        entry["net_cents"] += line.net_cents
        entry["vat_cents"] += line.vat_cents
    paragraphs = [quote.notes] if quote.notes else []
    if quote.deposit_percent:
        paragraphs.append(f"Acompte de {quote.deposit_percent} % à la commande.")
    if quote.acceptance_name and quote.accepted_at:
        paragraphs.append(
            f"Bon pour accord : {quote.acceptance_name}, le {_date(quote.accepted_at)}."
        )
    content = document_pdf.render(
        {
            "kind": "quote",
            "number": quote.number,
            "title": quote.title,
            "dates": [
                ("Date", _date(quote.created_at)),
                ("Valable jusqu'au", _date(quote.valid_until)),
            ],
            "seller": common.seller(),
            "customer": customer,
            "lines": [
                {
                    "description": x.description,
                    "quantity": x.quantity,
                    "unit_price_cents": x.unit_price_cents,
                    "vat_rate_bp": x.vat_rate_bp,
                    "net_cents": x.net_cents,
                }
                for x in lines
            ],
            "net_cents": quote.net_cents,
            "vat_breakdown": list(breakdown.values()),
            "gross_cents": quote.gross_cents,
            "paragraphs": paragraphs,
            "mentions": MENTIONS,
        }
    )
    return _pdf(content, quote.number)


# --- Client portal -------------------------------------------------------------------------


@router.get("", response_model=ClientBilling, summary="Billing of the organization")
async def client_billing(
    ctx: OrgContext, session: Session, locale: LocaleQuery = "fr"
) -> ClientBilling:
    return await overview.client_billing(session, ctx, locale)


@router.put("/profile", response_model=ProfileOut, summary="Billing details")
async def save_profile(data: ProfileIn, ctx: OrgContext, session: Session) -> ProfileOut:
    return await overview.save_profile(session, ctx, data)


@router.get("/quotes", response_model=QuotePage, summary="Quotes")
async def client_quotes(ctx: OrgContext, session: Session) -> QuotePage:
    return await quotes.list_quotes(session, ctx)


@router.get("/quotes/{quote_id}", response_model=QuoteOut, summary="A quote")
async def client_quote(quote_id: uuid.UUID, ctx: OrgContext, session: Session) -> QuoteOut:
    return await quotes.quote_out(session, await quotes.get_quote(session, ctx, quote_id))


@router.get("/quotes/{quote_id}/pdf", summary="Quote PDF", response_class=Response, responses=PDF)
async def client_quote_pdf(quote_id: uuid.UUID, ctx: OrgContext, session: Session) -> Response:
    return await _quote_pdf(session, await quotes.get_quote(session, ctx, quote_id))


@router.post(
    "/quotes/{quote_id}/accept",
    response_model=InvoiceOut,
    summary="Accept a quote (issues the first invoice)",
)
async def accept_quote(
    quote_id: uuid.UUID, data: Acceptance, ctx: OrgContext, session: Session
) -> InvoiceOut:
    invoice = await quotes.accept(session, ctx, quote_id, data)
    return await invoices.invoice_out(session, invoice)


@router.post("/quotes/{quote_id}/decline", response_model=QuoteOut, summary="Decline a quote")
async def decline_quote(
    quote_id: uuid.UUID, data: Decline, ctx: OrgContext, session: Session
) -> QuoteOut:
    return await quotes.quote_out(session, await quotes.decline(session, ctx, quote_id, data))


@router.get("/invoices", response_model=InvoicePage, summary="Invoices and credit notes")
async def client_invoices(ctx: OrgContext, session: Session) -> InvoicePage:
    return await invoices.list_invoices(session, ctx)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut, summary="An invoice")
async def client_invoice(invoice_id: uuid.UUID, ctx: OrgContext, session: Session) -> InvoiceOut:
    return await invoices.invoice_out(session, await invoices.get_invoice(session, ctx, invoice_id))


@router.get(
    "/invoices/{invoice_id}/pdf", summary="Invoice PDF", response_class=Response, responses=PDF
)
async def client_invoice_pdf(invoice_id: uuid.UUID, ctx: OrgContext, session: Session) -> Response:
    return await _invoice_pdf(session, await invoices.get_invoice(session, ctx, invoice_id))


@router.post(
    "/invoices/{invoice_id}/checkout",
    response_model=CheckoutOut,
    summary="Pay online (Stripe Checkout)",
)
async def pay_invoice(
    invoice_id: uuid.UUID,
    ctx: OrgContext,
    session: Session,
    stripe: Stripe,
    locale: LocaleQuery = "fr",
) -> CheckoutOut:
    return await checkout.pay_invoice(session, ctx, stripe, invoice_id, locale)


@router.get("/payments", response_model=list[PaymentOut], summary="Payments received")
async def client_payments(ctx: OrgContext, session: Session) -> list[PaymentOut]:
    return await invoices.list_payments(session, ctx)


@router.post("/subscriptions", response_model=CheckoutOut, summary="Subscribe (Stripe Checkout)")
async def subscribe(
    data: SubscribeIn, ctx: OrgContext, session: Session, stripe: Stripe
) -> CheckoutOut:
    return await checkout.subscribe(session, ctx, stripe, data.product_id, data.locale)


@router.post(
    "/subscriptions/{subscription_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel at period end, or resume",
)
async def cancel_subscription(
    subscription_id: uuid.UUID, data: CancelIn, ctx: OrgContext, session: Session, stripe: Stripe
) -> Response:
    await checkout.set_cancellation(session, ctx, stripe, subscription_id, data.cancel)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Paid courses, webhooks ----------------------------------------------------------------


@public_router.get(
    "/courses/{slug}/offer",
    response_model=CourseOffer,
    summary="Price of a paid course",
    responses={404: {"description": "Free course"}},
)
async def course_offer(slug: str, session: Session, locale: LocaleQuery = "fr") -> CourseOffer:
    return await checkout.course_offer(session, slug, locale, None)


@learner_router.get(
    "/courses/{slug}/offer",
    response_model=CourseOffer,
    summary="Price of a paid course, and where I can buy it",
)
async def my_course_offer(
    slug: str, user: CurrentUser, session: Session, locale: LocaleQuery = "fr"
) -> CourseOffer:
    return await checkout.course_offer(session, slug, locale, user)


@learner_router.post(
    "/courses/{slug}/checkout", response_model=CheckoutOut, summary="Buy a course (Stripe Checkout)"
)
async def buy_course(
    slug: str, data: CourseCheckoutIn, user: CurrentUser, session: Session, stripe: Stripe
) -> CheckoutOut:
    return await checkout.buy_course(session, user, stripe, slug, data)


@public_router.post(
    "/webhooks/stripe",
    status_code=status.HTTP_200_OK,
    summary="Stripe webhooks (signed)",
    include_in_schema=False,
)
async def stripe_webhook(
    request: Request, session: Session, stripe_signature: Annotated[str | None, Header()] = None
) -> dict[str, bool]:
    secret = get_settings().stripe_webhook_secret
    if secret is None:
        raise ServiceUnavailableError("Stripe webhooks are not configured")
    event = verify_signature(await request.body(), stripe_signature, secret.get_secret_value())
    return {"processed": await checkout.handle_event(session, event)}


def _simulated(stripe: StripeGateway) -> SimulatedStripeGateway:
    if not isinstance(stripe, SimulatedStripeGateway):
        raise NotFoundError("Not found")
    return stripe


@public_router.get(
    "/simulated-checkout/{session_id}", response_class=HTMLResponse, include_in_schema=False
)
async def simulated_page(session_id: str, stripe: Stripe) -> HTMLResponse:
    gateway = _simulated(stripe)
    request = gateway.sessions.get(session_id)
    if request is None:
        raise NotFoundError("Checkout session not found")
    amount = euros(request.item.amount_cents)
    interval = {"month": " / mois", "year": " / an"}.get(request.item.interval or "", "")
    return HTMLResponse(
        f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Paiement simulé</title></head><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem">
<p style="color:#d90000;font-weight:600">Paiement simulé (développement)</p><h1>{request.item.name}</h1><p style="font-size:2rem">{amount}{interval}</p>
<form method="post"><button style="font-size:1.1rem;padding:.8rem 1.4rem">Payer</button></form>
<p><a href="{request.cancel_url}">Annuler</a></p></body></html>"""
    )


@public_router.post("/simulated-checkout/{session_id}", include_in_schema=False)
async def simulated_pay(session_id: str, session: Session, stripe: Stripe) -> RedirectResponse:
    url = await checkout.simulate_payment(session, _simulated(stripe), session_id)
    return RedirectResponse(url, status_code=status.HTTP_303_SEE_OTHER)


# --- Back office ---------------------------------------------------------------------------


@admin_router.get(
    "/dashboard",
    response_model=AdminBilling,
    summary="Receivables, quotes awaiting, recurring revenue",
)
async def admin_dashboard(ctx: StaffContext, session: Session) -> AdminBilling:
    return await overview.admin_billing(session, ctx)


@admin_router.get(
    "/organizations", response_model=list[BillingOrganization], summary="Client organizations"
)
async def admin_organizations(ctx: StaffContext, session: Session) -> list[BillingOrganization]:
    common.require_admin(ctx)
    rows = await session.scalars(
        select(Organization).where(Organization.kind == "client").order_by(Organization.name)
    )
    return [BillingOrganization(id=o.id, name=o.name, slug=o.slug) for o in rows]


@admin_router.get("/products", response_model=list[ProductOut], summary="Catalog")
async def admin_products(ctx: StaffContext, session: Session) -> list[ProductOut]:
    return await catalog.list_products(session, ctx)


@admin_router.post(
    "/products",
    response_model=ProductOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add to the catalog",
)
async def create_product(data: ProductIn, ctx: StaffContext, session: Session) -> ProductOut:
    return common.product_out(await catalog.create_product(session, ctx, data))


@admin_router.put(
    "/products/{product_id}",
    response_model=ProductOut,
    summary="Update a product (future sales only)",
)
async def update_product(
    product_id: uuid.UUID, data: ProductIn, ctx: StaffContext, session: Session
) -> ProductOut:
    return common.product_out(await catalog.update_product(session, ctx, product_id, data))


@admin_router.get("/quotes", response_model=QuotePage, summary="Quotes of every client")
async def admin_quotes(
    ctx: StaffContext, session: Session, organization_id: uuid.UUID | None = None
) -> QuotePage:
    return await quotes.list_quotes(session, ctx, organization_id=organization_id)


@admin_router.post(
    "/quotes",
    response_model=QuoteOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a quote (draft)",
)
async def create_quote(data: QuoteCreate, ctx: StaffContext, session: Session) -> QuoteOut:
    return await quotes.quote_out(session, await quotes.create_quote(session, ctx, data))


@admin_router.get("/quotes/{quote_id}", response_model=QuoteOut, summary="A quote")
async def admin_quote(quote_id: uuid.UUID, ctx: StaffContext, session: Session) -> QuoteOut:
    return await quotes.quote_out(session, await quotes.get_quote(session, ctx, quote_id))


@admin_router.put("/quotes/{quote_id}", response_model=QuoteOut, summary="Update a draft quote")
async def update_quote(
    quote_id: uuid.UUID, data: QuoteIn, ctx: StaffContext, session: Session
) -> QuoteOut:
    return await quotes.quote_out(session, await quotes.update_quote(session, ctx, quote_id, data))


@admin_router.post("/quotes/{quote_id}/send", response_model=QuoteOut, summary="Send to the client")
async def send_quote(quote_id: uuid.UUID, ctx: StaffContext, session: Session) -> QuoteOut:
    return await quotes.quote_out(session, await quotes.send_quote(session, ctx, quote_id))


@admin_router.post("/quotes/{quote_id}/cancel", response_model=QuoteOut, summary="Cancel a quote")
async def cancel_quote(quote_id: uuid.UUID, ctx: StaffContext, session: Session) -> QuoteOut:
    return await quotes.quote_out(session, await quotes.cancel_quote(session, ctx, quote_id))


@admin_router.post(
    "/quotes/{quote_id}/balance",
    response_model=InvoiceOut,
    summary="Invoice the balance of an accepted quote",
)
async def invoice_balance(quote_id: uuid.UUID, ctx: StaffContext, session: Session) -> InvoiceOut:
    return await invoices.invoice_out(session, await quotes.invoice_balance(session, ctx, quote_id))


@admin_router.get(
    "/quotes/{quote_id}/pdf", summary="Quote PDF", response_class=Response, responses=PDF
)
async def admin_quote_pdf(quote_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
    return await _quote_pdf(session, await quotes.get_quote(session, ctx, quote_id))


@admin_router.get("/invoices", response_model=InvoicePage, summary="Invoices of every client")
async def admin_invoices(
    ctx: StaffContext,
    session: Session,
    organization_id: uuid.UUID | None = None,
    open_only: bool = False,
    page: Annotated[int, Query(ge=1)] = 1,
) -> InvoicePage:
    return await invoices.list_invoices(
        session, ctx, organization_id=organization_id, open_only=open_only, page=page
    )


@admin_router.get("/invoices/{invoice_id}", response_model=InvoiceOut, summary="An invoice")
async def admin_invoice(invoice_id: uuid.UUID, ctx: StaffContext, session: Session) -> InvoiceOut:
    return await invoices.invoice_out(session, await invoices.get_invoice(session, ctx, invoice_id))


@admin_router.get(
    "/invoices/{invoice_id}/pdf", summary="Invoice PDF", response_class=Response, responses=PDF
)
async def admin_invoice_pdf(invoice_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
    return await _invoice_pdf(session, await invoices.get_invoice(session, ctx, invoice_id))


@admin_router.post(
    "/invoices/{invoice_id}/credit-note",
    response_model=InvoiceOut,
    summary="Cancel an invoice with a credit note",
)
async def credit_note(
    invoice_id: uuid.UUID, data: CreditNoteIn, ctx: StaffContext, session: Session
) -> InvoiceOut:
    return await invoices.invoice_out(
        session, await invoices.credit(session, ctx, invoice_id, data)
    )


@admin_router.post(
    "/invoices/{invoice_id}/transfers", response_model=InvoiceOut, summary="Record a bank transfer"
)
async def record_transfer(
    invoice_id: uuid.UUID, data: TransferIn, ctx: StaffContext, session: Session
) -> InvoiceOut:
    return await invoices.invoice_out(
        session, await invoices.record_transfer(session, ctx, invoice_id, data)
    )


@admin_router.get("/payments", response_model=list[PaymentOut], summary="Transactions")
async def admin_payments(
    ctx: StaffContext, session: Session, organization_id: uuid.UUID | None = None
) -> list[PaymentOut]:
    return await invoices.list_payments(session, ctx, organization_id=organization_id)


@admin_router.get("/subscriptions", response_model=list[SubscriptionOut], summary="Subscriptions")
async def admin_subscriptions(
    ctx: StaffContext, session: Session, locale: LocaleQuery = "fr"
) -> list[SubscriptionOut]:
    return await checkout.list_subscriptions(session, ctx, locale)


@admin_router.post(
    "/subscriptions/{subscription_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel at period end, or resume",
)
async def admin_cancel_subscription(
    subscription_id: uuid.UUID, data: CancelIn, ctx: StaffContext, session: Session, stripe: Stripe
) -> Response:
    await checkout.set_cancellation(session, ctx, stripe, subscription_id, data.cancel)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
