import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { LinesTable } from "@/components/billing/lines-table";
import { BillingStatus } from "@/components/billing/status";
import { CreditNoteForm, TransferForm } from "@/components/billing-admin/actions";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { money } from "@/lib/billing";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; id: string }> };

/** An invoice in the back office: payments, bank transfers, credit note (TASK-112, TASK-115). */
export default function InvoiceAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <InvoiceAdmin params={params} />
    </Suspense>
  );
}

async function InvoiceAdmin({ params }: Props) {
  const { locale, id } = await params;
  if (!isUuid(id)) notFound();
  const loaded = await adminLoad(getPathname({ locale, href: { pathname: "/admin/billing/invoices/[id]", params: { id } } }), (api) =>
    api.GET("/api/v1/admin/billing/invoices/{invoice_id}", { params: { path: { invoice_id: id } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tBilling, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.billing.invoices" }),
    getTranslations({ locale, namespace: "Billing" }),
    getFormatter({ locale }),
  ]);
  const invoice = loaded.data;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "long" });
  const isInvoice = invoice.kind === "invoice";
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/billing/invoices" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-md font-semibold">
            {isInvoice ? tBilling("invoice.title", { number: invoice.number }) : tBilling("invoice.creditTitle", { number: invoice.number })}
          </h1>
          <BillingStatus
            value={!isInvoice ? "credit" : invoice.overdue ? "overdue" : invoice.status}
            label={!isInvoice ? tBilling("creditStatus") : invoice.overdue ? tBilling("overdue") : tBilling(`invoiceStatus.${invoice.status}`)}
          />
        </div>
        <p className="text-heading-sm">{invoice.title}</p>
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>{invoice.organization.name}</span>
          <span>{tBilling("invoice.issued", { date: date(invoice.issue_date) })}</span>
          {isInvoice ? <span>{tBilling("invoice.due", { date: date(invoice.due_date) })}</span> : null}
          {invoice.quote_number ? <span>{tBilling("invoice.quote", { number: invoice.quote_number })}</span> : null}
          {invoice.credited_invoice_number ? <span>{tBilling("invoice.credited", { number: invoice.credited_invoice_number })}</span> : null}
          {invoice.credit_note_number ? <span>{tBilling("invoice.creditNote", { number: invoice.credit_note_number })}</span> : null}
        </p>
        <div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/billing/invoices/${invoice.id}`}>
              <Download aria-hidden="true" />
              {tBilling("invoice.pdf")}
            </a>
          </Button>
        </div>
      </div>
      <LinesTable
        caption={invoice.title}
        lines={invoice.lines}
        totals={{
          ...invoice,
          extra: isInvoice ? [{ label: tBilling("invoice.paid"), cents: invoice.paid_cents }, { label: tBilling("invoice.remaining"), cents: invoice.due_cents }] : [],
        }}
      />
      <section aria-labelledby="invoice-payments" className="flex flex-col gap-3">
        <h2 id="invoice-payments" className="text-heading-sm font-semibold">{tBilling("invoice.payments")}</h2>
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tBilling("invoice.noPayment")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                <span>
                  {format.dateTime(new Date(p.received_at), { dateStyle: "medium" })} · {tBilling(`provider.${p.provider}`)}
                  {p.provider_ref ? <span className="text-muted-foreground"> · {p.provider_ref}</span> : null}
                </span>
                <span className="font-medium">{money(p.amount_cents, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {isInvoice && invoice.status !== "cancelled" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {invoice.due_cents > 0 ? (
            <section aria-labelledby="invoice-transfer" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
              <h2 id="invoice-transfer" className="text-heading-sm font-semibold">{t("transferTitle")}</h2>
              <TransferForm id={invoice.id} due={invoice.due_cents} locale={locale} />
            </section>
          ) : null}
          <section aria-labelledby="invoice-credit" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <h2 id="invoice-credit" className="text-heading-sm font-semibold">{t("creditTitle")}</h2>
            <CreditNoteForm id={invoice.id} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
