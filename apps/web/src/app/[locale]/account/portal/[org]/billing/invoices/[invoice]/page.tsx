import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PayButton } from "@/components/billing/client-forms";
import { LinesTable } from "@/components/billing/lines-table";
import { BillingStatus } from "@/components/billing/status";
import { PortalHeader } from "@/components/portal/portal-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { money } from "@/lib/billing";
import { isUuid } from "@/lib/sse-relay";
import { portalContext } from "@/lib/portal-server";

type Props = {
  params: Promise<{ locale: Locale; org: string; invoice: string }>;
  searchParams: Promise<{ paid?: string }>;
};

/** An invoice or a credit note; invoices are paid online or by transfer (TASK-112, TASK-113). */
export default function ClientInvoicePage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <ClientInvoice {...props} />
    </Suspense>
  );
}

async function ClientInvoice({ params, searchParams }: Props) {
  const [{ locale, org, invoice: invoiceId }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(invoiceId)) notFound();
  const { membership, api } = await portalContext(
    locale,
    { pathname: "/account/portal/[org]/billing/invoices/[invoice]", params: { org, invoice: invoiceId } },
    org,
  );
  const [result, overview] = await Promise.all([
    api
      .GET("/api/v1/organizations/{organization_id}/billing/invoices/{invoice_id}", { params: { path: { organization_id: org, invoice_id: invoiceId } } })
      .catch(() => undefined),
    api
      .GET("/api/v1/organizations/{organization_id}/billing", { params: { path: { organization_id: org }, query: { locale } } })
      .then((r) => r.data)
      .catch(() => undefined),
  ]);
  if (result?.response.status === 404) notFound();
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "Billing" }), getFormatter({ locale })]);
  const invoice = result?.data;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "long" });

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} role={membership.role} />
      <Link href={{ pathname: "/account/portal/[org]/billing", params: { org } }} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("invoice.back")}
      </Link>
      {!invoice ? (
        <p role="alert" className="text-destructive">{result?.response.status === 403 ? t("overview.forbidden") : t("errors.load")}</p>
      ) : (
        <>
          {query.paid && invoice.status !== "paid" ? <p role="status" className="rounded-xl border border-primary/30 bg-accent/40 p-4">{t("invoice.paidBanner")}</p> : null}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display-md font-semibold">
                {invoice.kind === "credit_note" ? t("invoice.creditTitle", { number: invoice.number }) : t("invoice.title", { number: invoice.number })}
              </h1>
              <BillingStatus
                value={invoice.kind === "credit_note" ? "credit" : invoice.overdue ? "overdue" : invoice.status}
                label={invoice.kind === "credit_note" ? t("creditStatus") : invoice.overdue ? t("overdue") : t(`invoiceStatus.${invoice.status}`)}
              />
            </div>
            <p className="text-heading-sm">{invoice.title}</p>
            <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>{t("invoice.issued", { date: date(invoice.issue_date) })}</span>
              {invoice.kind === "invoice" ? <span>{t("invoice.due", { date: date(invoice.due_date) })}</span> : null}
              {invoice.quote_number ? <span>{t("invoice.quote", { number: invoice.quote_number })}</span> : null}
              {invoice.credited_invoice_number ? <span>{t("invoice.credited", { number: invoice.credited_invoice_number })}</span> : null}
              {invoice.credit_note_number ? <span>{t("invoice.creditNote", { number: invoice.credit_note_number })}</span> : null}
            </p>
            <div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/billing/${org}/invoices/${invoice.id}`}>
                  <Download aria-hidden="true" />
                  {t("invoice.pdf")}
                </a>
              </Button>
            </div>
          </div>
          {invoice.due_cents > 0 ? (
            <section aria-label={t("invoice.remaining")} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-card p-5">
              <p className="text-heading-sm font-semibold">{t("invoice.remaining")} : {money(invoice.due_cents, locale)}</p>
              {overview?.online_payment ? (
                <>
                  <PayButton org={org} invoiceId={invoice.id} locale={locale} label={t("invoice.pay", { amount: money(invoice.due_cents, locale) })} />
                  <p className="text-xs text-muted-foreground">{t("invoice.payHelp")}</p>
                </>
              ) : null}
              <p className="text-sm">
                {invoice.seller.iban
                  ? t("invoice.transfer", { iban: String(invoice.seller.iban), reference: invoice.payment_reference })
                  : t("invoice.transferNoIban", { reference: invoice.payment_reference })}
              </p>
            </section>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {[["seller", invoice.seller, String(invoice.seller.name ?? "")], ["customer", invoice.customer, String(invoice.customer.legal_name ?? "")]].map(([key, party, name]) => {
              const details = party as Record<string, unknown>;
              return (
                <div key={key as string} className="rounded-xl border border-border bg-card p-4 text-sm">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{t(`invoice.${key as "seller" | "customer"}`)}</p>
                  <p className="font-medium">{name as string}</p>
                  {details.address ? <p>{String(details.address)}</p> : null}
                  {details.postal_code ? <p>{String(details.postal_code)} {String(details.city ?? "")}</p> : null}
                  {details.vat_number ? <p>TVA {String(details.vat_number)}</p> : null}
                </div>
              );
            })}
          </div>
          <LinesTable
            caption={invoice.title}
            lines={invoice.lines}
            totals={{
              ...invoice,
              extra: invoice.kind === "invoice" ? [{ label: t("invoice.paid"), cents: invoice.paid_cents }, { label: t("invoice.remaining"), cents: invoice.due_cents }] : [],
            }}
          />
          <section aria-labelledby="invoice-payments" className="flex flex-col gap-3">
            <h2 id="invoice-payments" className="text-heading-sm font-semibold">{t("invoice.payments")}</h2>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("invoice.noPayment")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                    <span>{format.dateTime(new Date(p.received_at), { dateStyle: "medium" })} · {t(`provider.${p.provider}`)}</span>
                    <span className="font-medium">{money(p.amount_cents, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
