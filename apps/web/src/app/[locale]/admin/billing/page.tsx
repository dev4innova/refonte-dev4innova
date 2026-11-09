import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { InvoiceList, QuoteList } from "@/components/billing/document-lists";
import { AdminNotice } from "@/components/admin/admin-notice";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { money } from "@/lib/billing";

type Props = { params: Promise<{ locale: Locale }> };

/** Billing overview: receivables, quotes awaiting, recurring revenue (EPIC 13). */
export default function BillingAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <BillingAdmin params={params} />
    </Suspense>
  );
}

async function BillingAdmin({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/billing" }), (api) => api.GET("/api/v1/admin/billing/dashboard"));
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const t = await getTranslations({ locale, namespace: "Admin.billing" });
  const d = loaded.data;
  const counts = [
    [t("overview.receivable"), money(d.receivable_cents, locale)],
    [t("overview.overdue", { count: d.overdue_invoices }), money(d.overdue_cents, locale)],
    [t("overview.awaiting"), String(d.quotes_awaiting)],
    [t("overview.accepted"), money(d.accepted_this_month_cents, locale)],
    [t("overview.recurring"), money(d.monthly_recurring_cents, locale)],
  ];
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("overview.title")}</h1>
        <p className="text-muted-foreground">{t("overview.lead")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {counts.map(([label, value]) => (
          <li key={label} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <span className="font-heading text-2xl font-semibold">{value}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="billing-open" className="flex min-w-0 flex-col gap-3">
          <h2 id="billing-open" className="text-heading-lg font-semibold">{t("overview.openInvoices")}</h2>
          <InvoiceList
            invoices={d.invoices}
            empty={t("overview.noInvoice")}
            showClient
            href={(i) => ({ pathname: "/admin/billing/invoices/[id]", params: { id: i.id } })}
            pdf={(i) => `/api/admin/billing/invoices/${i.id}`}
          />
        </section>
        <section aria-labelledby="billing-awaiting" className="flex min-w-0 flex-col gap-3">
          <h2 id="billing-awaiting" className="text-heading-lg font-semibold">{t("overview.awaitingQuotes")}</h2>
          <QuoteList quotes={d.quotes} empty={t("overview.noQuote")} showClient href={(q) => ({ pathname: "/admin/billing/quotes/[id]", params: { id: q.id } })} />
        </section>
      </div>
    </div>
  );
}
