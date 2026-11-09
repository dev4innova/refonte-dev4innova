import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { QuoteDecision } from "@/components/billing/client-forms";
import { InvoiceList } from "@/components/billing/document-lists";
import { LinesTable } from "@/components/billing/lines-table";
import { BillingStatus } from "@/components/billing/status";
import { PortalHeader } from "@/components/portal/portal-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isUuid } from "@/lib/sse-relay";
import { portalContext } from "@/lib/portal-server";

type Props = { params: Promise<{ locale: Locale; org: string; quote: string }> };

/** A quote, accepted or declined online by the client (TASK-111). */
export default function ClientQuotePage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <ClientQuote params={params} />
    </Suspense>
  );
}

async function ClientQuote({ params }: Props) {
  const { locale, org, quote: quoteId } = await params;
  if (!isUuid(quoteId)) notFound();
  const { membership, api } = await portalContext(
    locale,
    { pathname: "/account/portal/[org]/billing/quotes/[quote]", params: { org, quote: quoteId } },
    org,
  );
  const result = await api
    .GET("/api/v1/organizations/{organization_id}/billing/quotes/{quote_id}", { params: { path: { organization_id: org, quote_id: quoteId } } })
    .catch(() => undefined);
  if (result?.response.status === 404) notFound();
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "Billing" }), getFormatter({ locale })]);
  const quote = result?.data;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "long" });

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} role={membership.role} />
      <Link href={{ pathname: "/account/portal/[org]/billing", params: { org } }} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("quote.back")}
      </Link>
      {!quote ? (
        <p role="alert" className="text-destructive">{result?.response.status === 403 ? t("overview.forbidden") : t("errors.load")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display-md font-semibold">{t("quote.title", { number: quote.number })}</h1>
              <BillingStatus value={quote.expired ? "expired" : quote.status} label={quote.expired ? t("expired") : t(`quoteStatus.${quote.status}`)} />
            </div>
            <p className="text-heading-sm">{quote.title}</p>
            <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>{t("quote.validUntil", { date: date(quote.valid_until) })}</span>
              {quote.deposit_percent ? <span>{t("quote.deposit", { percent: quote.deposit_percent })}</span> : null}
            </p>
            <div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/billing/${org}/quotes/${quote.id}`}>
                  <Download aria-hidden="true" />
                  {t("quote.pdf")}
                </a>
              </Button>
            </div>
          </div>
          <LinesTable caption={t("quote.lines")} lines={quote.lines} totals={quote} />
          {quote.notes ? <p className="max-w-3xl text-sm whitespace-pre-line">{quote.notes}</p> : null}
          {quote.status === "sent" && !quote.expired ? <QuoteDecision org={org} quoteId={quote.id} deposit={quote.deposit_percent} /> : null}
          {quote.expired ? <p className="text-sm text-muted-foreground">{t("quote.expired")}</p> : null}
          {quote.status === "accepted" && quote.accepted_at ? (
            <p className="text-sm">{t("quote.accepted", { name: quote.acceptance_name ?? "", date: date(quote.accepted_at) })}</p>
          ) : null}
          {quote.status === "declined" && quote.declined_at ? <p className="text-sm">{t("quote.declined", { date: date(quote.declined_at) })}</p> : null}
          {quote.invoices.length > 0 ? (
            <section aria-labelledby="quote-invoices" className="flex flex-col gap-3">
              <h2 id="quote-invoices" className="text-heading-sm font-semibold">{t("quote.invoices")}</h2>
              <InvoiceList
                invoices={quote.invoices}
                empty=""
                href={(i) => ({ pathname: "/account/portal/[org]/billing/invoices/[invoice]", params: { org, invoice: i.id } })}
                pdf={(i) => `/api/billing/${org}/invoices/${i.id}`}
              />
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
