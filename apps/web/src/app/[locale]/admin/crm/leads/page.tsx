import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { CrmBadge } from "@/components/crm/crm-badge";
import { NewLeadForm } from "@/components/crm/new-lead-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { isOneOf, LEAD_STATUSES, OWNER_FILTERS, personLabel } from "@/lib/crm";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<SearchParams> };

const PAGE_SIZE = 25;

/** Prospects: search, filters and creation (TASK-067, TASK-070). */
export default function LeadsPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Leads {...props} />
    </Suspense>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function Leads({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const status = first(query.status);
  const owner = first(query.owner);
  const q = first(query.q).slice(0, 100);
  const page = Math.max(1, Number.parseInt(first(query.page), 10) || 1);
  const filters = {
    status: isOneOf(LEAD_STATUSES, status) ? status : undefined,
    owner: isOneOf(OWNER_FILTERS, owner) ? owner : "any",
    q: q || undefined,
  } as const;

  const path = getPathname({ locale, href: "/admin/crm/leads" });
  const loaded = await adminLoad(path, (api) =>
    api.GET("/api/v1/admin/crm/leads", {
      params: { query: { ...filters, page, page_size: PAGE_SIZE } },
    }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.crm" }),
    getFormatter({ locale }),
  ]);
  const { items, total } = loaded.data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => ({
    pathname: "/admin/crm/leads" as const,
    query: Object.fromEntries(
      Object.entries({ ...filters, page: target > 1 ? String(target) : undefined }).filter(
        ([, v]) => v !== undefined && v !== "any",
      ),
    ) as Record<string, string>,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-display-md font-semibold">{t("leads.title")}</h1>
        <NewLeadForm locale={locale} />
      </div>

      {/* Plain GET form: filters live in the URL and work without JavaScript. */}
      <form action={path} role="search" aria-label={t("leads.filters")} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {t("leads.search")}
          <Input type="search" name="q" defaultValue={q} maxLength={100} placeholder={t("leads.searchPlaceholder")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("leads.status")}
          <NativeSelect name="status" defaultValue={filters.status ?? ""}>
            <option value="">{t("leads.allStatuses")}</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`statuses.${s}`)}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("leads.owner")}
          <NativeSelect name="owner" defaultValue={filters.owner}>
            {OWNER_FILTERS.map((o) => (
              <option key={o} value={o}>{t(`owners.${o}`)}</option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" variant="secondary">{t("leads.apply")}</Button>
      </form>

      <p role="status" className="text-sm text-muted-foreground">{t("leads.count", { count: total })}</p>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">
          {t("leads.empty")}
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("leads.prospect")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("leads.status")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("leads.source")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("leads.owner")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("leads.lastActivity")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={{ pathname: "/admin/crm/leads/[id]", params: { id: lead.id } }}
                      className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <span className="block text-muted-foreground">
                      {lead.company ? `${lead.company} · ` : ""}
                      {lead.email}
                    </span>
                  </td>
                  <td className="px-4 py-3"><CrmBadge value={lead.status} label={t(`statuses.${lead.status}`)} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{t(`sources.${lead.source}`)}</td>
                  <td className="px-4 py-3">{personLabel(lead.owner) ?? <span className="text-muted-foreground">{t("unassigned")}</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format.dateTime(new Date(lead.last_activity_at), { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label={t("leads.pagination")} className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="font-medium text-primary underline-offset-4 hover:underline">
              {t("leads.previous")}
            </Link>
          ) : <span />}
          <span>{t("leads.page", { page, pages })}</span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="font-medium text-primary underline-offset-4 hover:underline">
              {t("leads.next")}
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
