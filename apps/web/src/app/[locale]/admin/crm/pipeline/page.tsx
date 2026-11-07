import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { StageSelect } from "@/components/crm/lead-controls";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { isOneOf, OWNER_FILTERS, personLabel, STAGES } from "@/lib/crm";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ owner?: string | string[] }>;
};

/** Sales pipeline: open opportunities by stage, and those closed in the last 30 days (TASK-069). */
export default function PipelinePage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Pipeline {...props} />
    </Suspense>
  );
}

async function Pipeline({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const ownerParam = Array.isArray(query.owner) ? query.owner[0] : query.owner;
  const owner = isOneOf(OWNER_FILTERS, ownerParam) ? ownerParam : "any";
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/crm/pipeline" }), (api) =>
    api.GET("/api/v1/admin/crm/opportunities", { params: { query: { owner, closed_within_days: 30 } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.crm" }),
    getFormatter({ locale }),
  ]);
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-md font-semibold">{t("pipeline.title")}</h1>
          <p className="text-muted-foreground">{t("pipeline.lead")}</p>
        </div>
        <nav aria-label={t("leads.owner")}>
          <ul className="flex gap-2 text-sm">
            {OWNER_FILTERS.map((filter) => (
              <li key={filter}>
                <Link
                  href={{ pathname: "/admin/crm/pipeline", query: filter === "any" ? {} : { owner: filter } }}
                  aria-current={owner === filter ? "true" : undefined}
                  className="inline-flex h-9 items-center rounded-full border border-border px-3 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=true]:bg-secondary aria-[current=true]:text-secondary-foreground"
                >
                  {t(`owners.${filter}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Columns scroll inside their container, never the page. */}
      <div className="relative -mx-gutter overflow-x-auto px-gutter pb-2">
        <ol className="grid min-w-[72rem] grid-cols-5 gap-4">
          {STAGES.map((stage) => {
            const items = loaded.data.filter((o) => o.stage === stage);
            const total = items.reduce((sum, o) => sum + Number(o.amount ?? 0), 0);
            const closed = stage === "won" || stage === "lost";
            return (
              <li key={stage} aria-labelledby={`stage-${stage}`} className={cn("flex flex-col gap-3 rounded-xl p-3", closed ? "bg-muted/60" : "bg-muted")}>
                <div className="flex flex-col gap-0.5 px-1">
                  <h2 id={`stage-${stage}`} className="text-sm font-semibold">
                    {t(`stages.${stage}`)} <span className="font-normal text-muted-foreground">({items.length})</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {money(total)}
                    {closed ? ` · ${t("pipeline.last30Days")}` : ""}
                  </p>
                </div>
                {items.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">{t("pipeline.empty")}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {items.map((o) => (
                      <li key={o.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-card">
                        <p className="text-sm font-medium">{o.title}</p>
                        <Link
                          href={{ pathname: "/admin/crm/leads/[id]", params: { id: o.lead.id } }}
                          className="text-xs text-primary underline-offset-4 hover:underline"
                        >
                          {o.lead.company ? `${o.lead.name} · ${o.lead.company}` : o.lead.name}
                        </Link>
                        <p className="flex justify-between gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">{o.amount ? money(Number(o.amount)) : "—"}</span>
                          <span>
                            {o.expected_close_on
                              ? format.dateTime(new Date(`${o.expected_close_on}T00:00:00`), { dateStyle: "medium" })
                              : null}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{personLabel(o.owner) ?? t("unassigned")}</p>
                        <StageSelect opportunityId={o.id} stage={o.stage} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
