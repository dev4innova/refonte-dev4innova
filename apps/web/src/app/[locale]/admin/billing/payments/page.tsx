import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { BillingStatus } from "@/components/billing/status";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { money } from "@/lib/billing";

type Props = { params: Promise<{ locale: Locale }> };

/** Transactions and subscriptions of every client (TASK-114, TASK-115). */
export default function PaymentsAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PaymentsAdmin params={params} />
    </Suspense>
  );
}

async function PaymentsAdmin({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/billing/payments" }), async (api) => {
    const [payments, subscriptions] = await Promise.all([
      api.GET("/api/v1/admin/billing/payments"),
      api.GET("/api/v1/admin/billing/subscriptions", { params: { query: { locale } } }),
    ]);
    return { data: payments.data && subscriptions.data ? { payments: payments.data, subscriptions: subscriptions.data } : undefined, response: payments.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tBilling, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.billing.payments" }),
    getTranslations({ locale, namespace: "Billing" }),
    getFormatter({ locale }),
  ]);
  const { payments, subscriptions } = loaded.data;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="payments-title" className="flex flex-col gap-4">
        <h1 id="payments-title" className="text-display-md font-semibold">{t("title")}</h1>
        {payments.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="border-b border-border text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="p-3">{t("date")}</th>
                  <th scope="col" className="p-3">{t("client")}</th>
                  <th scope="col" className="p-3">{t("invoice")}</th>
                  <th scope="col" className="p-3">{t("method")}</th>
                  <th scope="col" className="p-3 text-right">{t("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 whitespace-nowrap">{format.dateTime(new Date(p.received_at), { dateStyle: "medium" })}</td>
                    <td className="p-3">{p.organization.name}</td>
                    <td className="p-3">
                      <Link href={{ pathname: "/admin/billing/invoices/[id]", params: { id: p.invoice_id } }} className="font-medium text-primary underline-offset-4 hover:underline">
                        {p.invoice_number}
                      </Link>
                    </td>
                    <td className="p-3">{tBilling(`provider.${p.provider}`)}</td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">{money(p.amount_cents, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="subscriptions-title" className="flex flex-col gap-4">
        <h2 id="subscriptions-title" className="text-heading-lg font-semibold">{t("subscriptions")}</h2>
        {subscriptions.length === 0 ? (
          <p className="text-muted-foreground">{t("noSubscription")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{s.organization.name} – {s.offer.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {money(s.offer.gross_cents, locale)} {tBilling("includingVat")} {s.offer.interval ? tBilling(`interval.${s.offer.interval}`) : null}
                    {s.current_period_end ? <> · {format.dateTime(new Date(s.current_period_end), { dateStyle: "medium" })}</> : null}
                  </span>
                </div>
                <BillingStatus value={s.status} label={tBilling(`subscriptionStatus.${s.status}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
