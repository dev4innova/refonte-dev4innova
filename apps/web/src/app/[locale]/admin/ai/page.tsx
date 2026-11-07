import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { QuotaForm } from "@/components/ai/quota-form";
import { CrmBadge } from "@/components/crm/crm-badge";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: Locale }> };

/** Usage, costs and budgets of the month (TASK-080, TASK-081). */
export default function AiUsagePage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Usage params={params} />
    </Suspense>
  );
}

async function Usage({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/ai" }), (api) =>
    api.GET("/api/v1/admin/ai/usage"),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const report = loaded.data;
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.ai" }),
    getFormatter({ locale }),
  ]);
  const euros = (value: string | number, digits = 2) =>
    format.number(Number(value), { style: "currency", currency: "EUR", maximumFractionDigits: digits });
  const [year, month] = report.month.split("-").map(Number);
  const monthLabel = format.dateTime(new Date(year as number, (month as number) - 1, 1), { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("usage.title")}</h1>
        <p className="text-muted-foreground">
          {t("usage.lead", { month: monthLabel, rate: format.number(Number(report.eur_per_usd), { maximumFractionDigits: 4 }) })}
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        <li className="flex flex-col gap-1 rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">{t("usage.total")}</p>
          <p className="font-heading text-heading-lg font-semibold">{euros(report.total_cost_eur)}</p>
        </li>
        <li className="flex flex-col gap-1 rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">{t("usage.calls")}</p>
          <p className="font-heading text-heading-lg font-semibold">
            {format.number(report.models.reduce((sum, m) => sum + m.calls, 0))}
          </p>
        </li>
        <li className="flex flex-col gap-1 rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">{t("usage.defaultBudgetLabel")}</p>
          <p className="font-heading text-heading-lg font-semibold">{euros(report.default_budget_eur)}</p>
        </li>
      </ul>

      <section aria-labelledby="ai-budgets" className="flex flex-col gap-4">
        <h2 id="ai-budgets" className="text-heading-lg font-semibold">{t("usage.budgets")}</h2>
        <p className="text-sm text-muted-foreground">{t("usage.budgetsHelp")}</p>
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("usage.organization")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("usage.spent")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("usage.budget")}</th>
              </tr>
            </thead>
            <tbody>
              {report.organizations.map((org) => {
                const ratio = Number(org.monthly_budget_eur) > 0 ? Number(org.spent_eur) / Number(org.monthly_budget_eur) : 1;
                return (
                  <tr key={org.organization_id} className="border-b border-border last:border-0 align-top">
                    <th scope="row" className="px-4 py-3 font-medium">{org.organization_name}</th>
                    <td className="px-4 py-3">
                      <span className="flex flex-col gap-1.5">
                        <span className="tabular-nums">
                          {euros(org.spent_eur)} / {euros(org.monthly_budget_eur)} · {t("usage.callCount", { count: org.calls })}
                        </span>
                        <span aria-hidden="true" className="block h-1.5 w-40 rounded-full bg-muted">
                          <span
                            className={cn("block h-full rounded-full", ratio >= 0.9 ? "bg-destructive" : "bg-primary")}
                            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <QuotaForm
                        organizationId={org.organization_id}
                        organizationName={org.organization_name}
                        budget={org.monthly_budget_eur}
                        specific={org.has_specific_budget}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ai-models-usage" className="flex flex-col gap-4">
        <h2 id="ai-models-usage" className="text-heading-lg font-semibold">{t("usage.byModel")}</h2>
        {report.models.length === 0 ? (
          <p className="text-muted-foreground">{t("usage.none")}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t("usage.model")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("usage.calls")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("usage.tokens")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("usage.cost")}</th>
                </tr>
              </thead>
              <tbody>
                {report.models.map((m) => (
                  <tr key={`${m.provider}-${m.model}`} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      {t(`providers.${m.provider}` as "providers.anthropic")} · <span className="font-mono text-xs">{m.model}</span>
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">{format.number(m.calls)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format.number(m.input_tokens)} → {format.number(m.output_tokens)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{euros(m.cost_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="ai-recent" className="flex flex-col gap-4">
        <h2 id="ai-recent" className="text-heading-lg font-semibold">{t("usage.recent")}</h2>
        <p className="text-sm text-muted-foreground">{t("usage.recentHelp")}</p>
        {report.recent.length === 0 ? (
          <p className="text-muted-foreground">{t("usage.none")}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-border bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t("usage.date")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("usage.feature")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("usage.model")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("usage.status")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("usage.tokens")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("usage.cost")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("usage.latency")}</th>
                </tr>
              </thead>
              <tbody>
                {report.recent.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {format.dateTime(new Date(r.created_at), { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      {r.feature}
                      {r.prompt_key ? <span className="block font-mono text-xs text-muted-foreground">{r.prompt_key} v{r.prompt_version}</span> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.model}</td>
                    <td className="px-4 py-3">
                      <CrmBadge
                        value={r.status === "ok" ? "answered" : r.status === "refused" ? "declined" : "new"}
                        label={r.error_code ? `${t(`usageStatuses.${r.status}` as "usageStatuses.ok")} (${r.error_code})` : t(`usageStatuses.${r.status}` as "usageStatuses.ok")}
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{format.number(r.input_tokens)} → {format.number(r.output_tokens)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{euros(r.cost_eur, 6)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format.number(r.latency_ms / 1000, { maximumFractionDigits: 1 })} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
