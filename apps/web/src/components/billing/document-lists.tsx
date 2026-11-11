import { Download } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { type InvoiceSummary, money, type QuoteSummary } from "@/lib/billing";

import { BillingStatus } from "./status";

type Href<T> = (item: T) => Parameters<typeof Link>[0]["href"];

/** Quotes, newest first. */
export async function QuoteList({ quotes, href, empty, showClient = false }: { quotes: QuoteSummary[]; href: Href<QuoteSummary>; empty: string; showClient?: boolean }) {
  const [t, format, locale] = await Promise.all([getTranslations("Billing"), getFormatter(), getLocale()]);
  if (quotes.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {quotes.map((q) => (
        <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link href={href(q)} className="font-medium break-words underline-offset-4 hover:text-primary-ink hover:underline">
              {q.number} – {q.title}
            </Link>
            <span className="text-xs text-muted-foreground">
              {showClient ? <>{q.organization.name} · </> : null}
              {money(q.gross_cents, locale)} {t("includingVat")} · {t("quote.validUntil", { date: format.dateTime(new Date(q.valid_until), { dateStyle: "medium" }) })}
            </span>
          </div>
          <BillingStatus value={q.expired ? "expired" : q.status} label={q.expired ? t("expired") : t(`quoteStatus.${q.status}`)} />
        </li>
      ))}
    </ul>
  );
}

/** Invoices and credit notes, with their PDF. */
export async function InvoiceList({
  invoices,
  href,
  pdf,
  empty,
  showClient = false,
}: {
  invoices: InvoiceSummary[];
  href: Href<InvoiceSummary>;
  pdf: (invoice: InvoiceSummary) => string;
  empty: string;
  showClient?: boolean;
}) {
  const [t, format, locale] = await Promise.all([getTranslations("Billing"), getFormatter(), getLocale()]);
  if (invoices.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {invoices.map((i) => {
        const status = i.kind === "credit_note" ? "credit" : i.overdue ? "overdue" : i.status;
        const label = i.kind === "credit_note" ? t("creditStatus") : i.overdue ? t("overdue") : t(`invoiceStatus.${i.status}`);
        return (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href={href(i)} className="font-medium break-words underline-offset-4 hover:text-primary-ink hover:underline">
                {i.number} – {i.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {showClient ? <>{i.organization.name} · </> : null}
                {t(`purpose.${i.purpose}`)} · {format.dateTime(new Date(i.issue_date), { dateStyle: "medium" })} · {money(i.gross_cents, locale)} {t("includingVat")}
                {i.due_cents > 0 && i.due_cents !== i.gross_cents ? <> · {t("invoice.remaining")} {money(i.due_cents, locale)}</> : null}
              </span>
            </div>
            <span className="flex items-center gap-3">
              <BillingStatus value={status} label={label} />
              <a href={pdf(i)} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted" aria-label={`${t("invoice.pdf")} : ${i.number}`}>
                <Download aria-hidden="true" className="size-4" />
              </a>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
