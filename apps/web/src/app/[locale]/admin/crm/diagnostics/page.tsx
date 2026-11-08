import { Download } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ all?: string }> };

/** Diagnostics of the website (TASK-093, TASK-095): score, company, prospect, PDF report. */
export default function DiagnosticsPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Diagnostics {...props} />
    </Suspense>
  );
}

async function Diagnostics({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const all = query.all === "1";
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/crm/diagnostics" }), (api) =>
    api.GET("/api/v1/admin/crm/diagnostics", { params: { query: { unlocked_only: !all, page_size: 100 } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "Admin.crm" }), getFormatter({ locale })]);
  const { items, total } = loaded.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("diagnostics.title")}</h1>
        <p className="text-muted-foreground">{t("diagnostics.lead")}</p>
      </div>
      <nav aria-label={t("diagnostics.filter")}>
        <ul className="flex flex-wrap gap-2 text-sm">
          {[false, true].map((value) => (
            <li key={String(value)}>
              <Link
                href={{ pathname: "/admin/crm/diagnostics", query: value ? { all: "1" } : {} }}
                aria-current={all === value ? "true" : undefined}
                className="inline-flex h-9 items-center rounded-full border border-border px-3 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=true]:bg-secondary aria-[current=true]:text-secondary-foreground"
              >
                {value ? t("diagnostics.all") : t("diagnostics.withContact")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p role="status" className="text-sm text-muted-foreground">{t("diagnostics.count", { count: total })}</p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">{t("diagnostics.empty")}</p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("diagnostics.date")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("diagnostics.contact")}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t("diagnostics.score")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("diagnostics.level")}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t("diagnostics.report")}</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{format.dateTime(new Date(d.created_at), { dateStyle: "medium" })}</td>
                  <td className="px-4 py-3">
                    {d.lead_id ? (
                      <Link href={{ pathname: "/admin/crm/leads/[id]", params: { id: d.lead_id } }} className="font-medium underline-offset-4 hover:text-primary hover:underline">
                        {d.contact_company ?? d.contact_name ?? d.contact_email}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t("diagnostics.anonymous")}</span>
                    )}
                    {d.contact_email ? <span className="block text-muted-foreground">{d.contact_email}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{d.overall_score}</td>
                  <td className="px-4 py-3">{t(`diagnosticLevels.${d.level as "discovery"}`)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/admin/diagnostics/${d.id}/report`} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                      <Download aria-hidden="true" className="size-4" />
                      {t("diagnostics.report")}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
