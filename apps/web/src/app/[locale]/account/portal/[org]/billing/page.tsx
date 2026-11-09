import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CancelSubscription, ProfileForm, SubscribeButton } from "@/components/billing/client-forms";
import { InvoiceList, QuoteList } from "@/components/billing/document-lists";
import { BillingStatus } from "@/components/billing/status";
import { PortalHeader } from "@/components/portal/portal-header";
import type { Locale } from "@/i18n/routing";
import { money } from "@/lib/billing";
import { portalContext } from "@/lib/portal-server";

type Props = {
  params: Promise<{ locale: Locale; org: string }>;
  searchParams: Promise<{ subscribed?: string }>;
};

/** Billing of the organization: quotes, invoices, subscriptions, details (EPIC 13). */
export default function ClientBillingPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <ClientBilling {...props} />
    </Suspense>
  );
}

async function ClientBilling({ params, searchParams }: Props) {
  const [{ locale, org }, query] = await Promise.all([params, searchParams]);
  const { membership, api } = await portalContext(locale, { pathname: "/account/portal/[org]/billing", params: { org } }, org);
  const [t, format, result] = await Promise.all([
    getTranslations({ locale, namespace: "Billing" }),
    getFormatter({ locale }),
    api
      .GET("/api/v1/organizations/{organization_id}/billing", { params: { path: { organization_id: org }, query: { locale } } })
      .catch(() => undefined),
  ]);
  const data = result?.data;
  const forbidden = result?.response.status === 403;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} role={membership.role} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("overview.title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("overview.lead")}</p>
      </div>
      {forbidden ? (
        <p role="alert" className="text-muted-foreground">{t("overview.forbidden")}</p>
      ) : !data ? (
        <p role="alert" className="text-destructive">{t("errors.load")}</p>
      ) : (
        <>
          {query.subscribed ? <p role="status" className="rounded-xl border border-primary/30 bg-accent/40 p-4">{t("overview.subscribed")}</p> : null}
          <p className="text-heading-sm font-semibold">
            {data.due_cents > 0 ? t("overview.due", { amount: money(data.due_cents, locale) }) : t("overview.nothingDue")}
          </p>
          {!data.online_payment ? <p className="text-sm text-muted-foreground">{t("overview.onlinePaymentOff")}</p> : null}
          {!data.profile ? <p role="status" className="rounded-xl border border-border bg-muted p-4 text-sm">{t("profile.missing")}</p> : null}

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex min-w-0 flex-col gap-8">
              <section aria-labelledby="billing-quotes" className="flex flex-col gap-3">
                <h2 id="billing-quotes" className="text-heading-lg font-semibold">{t("overview.quotes")}</h2>
                <QuoteList
                  quotes={data.quotes}
                  empty={t("overview.noQuote")}
                  href={(q) => ({ pathname: "/account/portal/[org]/billing/quotes/[quote]", params: { org, quote: q.id } })}
                />
              </section>
              <section aria-labelledby="billing-invoices" className="flex flex-col gap-3">
                <h2 id="billing-invoices" className="text-heading-lg font-semibold">{t("overview.invoices")}</h2>
                <InvoiceList
                  invoices={data.invoices}
                  empty={t("overview.noInvoice")}
                  href={(i) => ({ pathname: "/account/portal/[org]/billing/invoices/[invoice]", params: { org, invoice: i.id } })}
                  pdf={(i) => `/api/billing/${org}/invoices/${i.id}`}
                />
              </section>
              <section aria-labelledby="billing-subscriptions" className="flex flex-col gap-3">
                <h2 id="billing-subscriptions" className="text-heading-lg font-semibold">{t("overview.subscriptions")}</h2>
                {data.subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("overview.noSubscription")}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                    {data.subscriptions.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium">{s.offer.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {money(s.offer.gross_cents, locale)} {t("includingVat")} {s.offer.interval ? t(`interval.${s.offer.interval}`) : null}
                            {s.current_period_end ? <> · {s.cancel_at_period_end ? t("overview.endsOn", { date: date(s.current_period_end) }) : t("overview.renews", { date: date(s.current_period_end) })}</> : null}
                          </span>
                        </div>
                        <span className="flex flex-wrap items-center gap-2">
                          <BillingStatus value={s.status} label={t(`subscriptionStatus.${s.status}`)} />
                          {s.status === "active" || s.status === "past_due" ? <CancelSubscription org={org} id={s.id} cancelling={s.cancel_at_period_end} /> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {data.offers.length > 0 && data.online_payment ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <h3 className="text-heading-sm font-semibold">{t("overview.offers")}</h3>
                    <ul className="grid gap-4 md:grid-cols-2">
                      {data.offers
                        .filter((o) => !data.subscriptions.some((s) => s.offer.id === o.id && (s.status === "active" || s.status === "past_due")))
                        .map((o) => (
                          <li key={o.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold">{o.name}</span>
                              {o.description ? <span className="text-sm text-muted-foreground">{o.description}</span> : null}
                              <span className="text-sm">{money(o.gross_cents, locale)} {t("includingVat")} {o.interval ? t(`interval.${o.interval}`) : null}</span>
                            </div>
                            <SubscribeButton org={org} productId={o.id} locale={locale} label={t("overview.subscribe")} name={t("overview.subscribeName", { name: o.name })} />
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </div>
            <aside aria-labelledby="billing-profile" className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-5">
              <h2 id="billing-profile" className="text-heading-sm font-semibold">{t("profile.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("profile.help")}</p>
              <ProfileForm org={org} profile={data.profile ?? null} />
            </aside>
          </div>
        </>
      )}
    </>
  );
}
