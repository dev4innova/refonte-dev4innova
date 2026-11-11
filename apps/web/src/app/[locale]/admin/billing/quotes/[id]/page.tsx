import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { InvoiceList } from "@/components/billing/document-lists";
import { LinesTable } from "@/components/billing/lines-table";
import { BillingStatus } from "@/components/billing/status";
import { QuoteButtons } from "@/components/billing-admin/actions";
import { QuoteEditor } from "@/components/billing-admin/quote-editor";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { money } from "@/lib/billing";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; id: string }> };

/** A quote in the back office: draft editing, sending, balance invoice (TASK-111). */
export default function QuoteAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <QuoteAdmin params={params} />
    </Suspense>
  );
}

async function QuoteAdmin({ params }: Props) {
  const { locale, id } = await params;
  if (!isUuid(id)) notFound();
  const loaded = await adminLoad(getPathname({ locale, href: { pathname: "/admin/billing/quotes/[id]", params: { id } } }), async (api) => {
    const [quote, products] = await Promise.all([
      api.GET("/api/v1/admin/billing/quotes/{quote_id}", { params: { path: { quote_id: id } } }),
      api.GET("/api/v1/admin/billing/products"),
    ]);
    return { data: quote.data && products.data ? { quote: quote.data, products: products.data } : undefined, response: quote.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tBilling, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.billing.quotes" }),
    getTranslations({ locale, namespace: "Billing" }),
    getFormatter({ locale }),
  ]);
  const { quote, products } = loaded.data;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "long" });
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/billing/quotes" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-md font-semibold">{tBilling("quote.title", { number: quote.number })}</h1>
          <BillingStatus value={quote.expired ? "expired" : quote.status} label={quote.expired ? tBilling("expired") : tBilling(`quoteStatus.${quote.status}`)} />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("client", { name: quote.organization.name })} · {tBilling("quote.validUntil", { date: date(quote.valid_until) })}
          {quote.deposit_percent ? <> · {tBilling("quote.deposit", { percent: quote.deposit_percent })}</> : null}
        </p>
        {quote.status === "accepted" && quote.accepted_at ? (
          <p className="text-sm">{tBilling("quote.accepted", { name: quote.acceptance_name ?? "", date: date(quote.accepted_at) })}</p>
        ) : null}
        {quote.status === "declined" && quote.declined_at ? (
          <p className="text-sm">{tBilling("quote.declined", { date: date(quote.declined_at) })} {quote.decline_reason ? `« ${quote.decline_reason} »` : null}</p>
        ) : null}
        {quote.status === "accepted" ? <p className="text-sm font-medium">{t("remaining", { amount: money(quote.remaining_to_invoice_cents, locale) })}</p> : null}
        <div className="flex flex-wrap items-start gap-3">
          <QuoteButtons id={quote.id} status={quote.status} remaining={quote.remaining_to_invoice_cents} />
          <Button asChild variant="ghost">
            <a href={`/api/admin/billing/quotes/${quote.id}`}>
              <Download aria-hidden="true" />
              {t("pdf")}
            </a>
          </Button>
        </div>
      </div>
      {quote.status === "draft" ? (
        <QuoteEditor products={products} quote={quote} />
      ) : (
        <LinesTable caption={tBilling("quote.lines")} lines={quote.lines} totals={quote} />
      )}
      {quote.invoices.length > 0 ? (
        <section aria-labelledby="quote-invoices" className="flex flex-col gap-3">
          <h2 id="quote-invoices" className="text-heading-sm font-semibold">{tBilling("quote.invoices")}</h2>
          <InvoiceList
            invoices={quote.invoices}
            empty=""
            href={(i) => ({ pathname: "/admin/billing/invoices/[id]", params: { id: i.id } })}
            pdf={(i) => `/api/admin/billing/invoices/${i.id}`}
          />
        </section>
      ) : null}
    </div>
  );
}
