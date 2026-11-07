import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { ContentGridSkeleton } from "@/components/cms/content-grid";
import { CrmBadge } from "@/components/crm/crm-badge";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { LEAD_STATUSES, OPEN_STAGES } from "@/lib/crm";

type Props = { params: Promise<{ locale: Locale }> };

/** Sales dashboard (TASK-071). */
export default function CrmDashboardPage({ params }: Props) {
  return (
    <Suspense fallback={<ContentGridSkeleton count={6} />}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/crm" }), (api) =>
    api.GET("/api/v1/admin/crm/dashboard"),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const data = loaded.data;
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.crm" }),
    getFormatter({ locale }),
  ]);
  const money = (amount: string | number) =>
    format.number(Number(amount), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const maxAmount = Math.max(1, ...data.pipeline.map((s) => Number(s.amount)));

  const figures = [
    { key: "newLeads" as const, value: format.number(data.new_leads_30_days), href: "/admin/crm/leads" as const },
    {
      key: "unassigned" as const,
      value: format.number(data.unassigned_open_leads),
      href: { pathname: "/admin/crm/leads" as const, query: { owner: "unassigned" } },
    },
    {
      key: "mine" as const,
      value: format.number(data.my_open_leads),
      href: { pathname: "/admin/crm/leads" as const, query: { owner: "me" } },
    },
    {
      key: "newQuotes" as const,
      value: format.number(data.new_quote_requests),
      href: { pathname: "/admin/crm/quotes" as const, query: { status: "new" } },
    },
    { key: "openPipeline" as const, value: money(data.open_pipeline_amount), href: "/admin/crm/pipeline" as const },
    {
      key: "won" as const,
      value: money(data.won_90_days.amount),
      detail: t("dashboard.wonDetail", { count: data.won_90_days.count }),
    },
    {
      key: "winRate" as const,
      value:
        data.win_rate_90_days === null || data.win_rate_90_days === undefined
          ? "—"
          : format.number(data.win_rate_90_days, { style: "percent" }),
      detail: t("dashboard.winRateDetail", { won: data.won_90_days.count, lost: data.lost_90_days }),
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.lead")}</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => (
          <li key={figure.key} className="relative flex flex-col gap-1 rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">
              {figure.href ? (
                <Link
                  href={figure.href}
                  className="after:absolute after:inset-0 after:rounded-xl hover:text-foreground focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
                >
                  {t(`dashboard.figures.${figure.key}`)}
                </Link>
              ) : (
                t(`dashboard.figures.${figure.key}`)
              )}
            </p>
            <p className="font-heading text-heading-lg font-semibold">{figure.value}</p>
            {figure.detail ? <p className="text-xs text-muted-foreground">{figure.detail}</p> : null}
          </li>
        ))}
      </ul>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="crm-pipeline" className="flex flex-col gap-4">
          <h2 id="crm-pipeline" className="text-heading-lg font-semibold">{t("dashboard.pipeline")}</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 font-medium">{t("dashboard.stage")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("dashboard.count")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("dashboard.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {OPEN_STAGES.map((stage) => {
                const total = data.pipeline.find((s) => s.stage === stage);
                const amount = Number(total?.amount ?? 0);
                return (
                  <tr key={stage} className="border-t border-border">
                    <th scope="row" className="py-3 font-medium">
                      <span className="flex flex-col gap-2">
                        {t(`stages.${stage}`)}
                        <span aria-hidden="true" className="block h-1.5 rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.round((amount / maxAmount) * 100)}%` }}
                          />
                        </span>
                      </span>
                    </th>
                    <td className="py-3 text-right tabular-nums">{format.number(total?.count ?? 0)}</td>
                    <td className="py-3 text-right tabular-nums">{money(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="crm-statuses" className="flex flex-col gap-4">
          <h2 id="crm-statuses" className="text-heading-lg font-semibold">{t("dashboard.statuses")}</h2>
          <ul className="flex flex-col divide-y divide-border">
            {LEAD_STATUSES.map((status) => (
              <li key={status} className="flex items-center justify-between py-3 text-sm">
                <Link
                  href={{ pathname: "/admin/crm/leads", query: { status } }}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <CrmBadge value={status} label={t(`statuses.${status}`)} />
                </Link>
                <span className="tabular-nums">{format.number(data.leads_by_status[status] ?? 0)}</span>
              </li>
            ))}
          </ul>
          <h3 className="pt-2 text-heading-sm font-semibold">{t("dashboard.sources")}</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {(["contact_form", "quote_request", "manual"] as const).map((source) => (
              <li key={source} className="flex justify-between">
                <span>{t(`sources.${source}`)}</span>
                <span className="tabular-nums">{format.number(data.leads_by_source_30_days[source] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
