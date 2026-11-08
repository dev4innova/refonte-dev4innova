import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { StaffTicketList } from "@/components/portal-admin/ticket-list";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { TICKET_FILTERS, ticketFilter } from "@/lib/portal";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ state?: string; mine?: string }> };

/** Support requests of every client (TASK-101). */
export default function PortalSupportAdminPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalSupportAdmin {...props} />
    </Suspense>
  );
}

async function PortalSupportAdmin({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const state = ticketFilter(query.state);
  const mine = query.mine === "1";
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/portal/support" }), (api) =>
    api.GET("/api/v1/admin/portal/tickets", { params: { query: { state, mine } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tp] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.portal.support" }),
    getTranslations({ locale, namespace: "Portal" }),
  ]);
  const chip =
    "inline-flex h-9 items-center rounded-full border border-border px-4 font-medium hover:bg-muted aria-[current=page]:border-secondary aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>
      <nav aria-label={tp("support.filters.label")} className="flex flex-wrap gap-4">
        <ul className="flex flex-wrap gap-2 text-sm">
          {TICKET_FILTERS.map((filter) => (
            <li key={filter}>
              <Link
                href={{ pathname: "/admin/portal/support", query: { state: filter, ...(mine ? { mine: "1" } : {}) } }}
                aria-current={filter === state ? "page" : undefined}
                className={chip}
              >
                {tp(`support.filters.${filter}`)}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-2 text-sm">
          {[false, true].map((value) => (
            <li key={String(value)}>
              <Link
                href={{ pathname: "/admin/portal/support", query: { state, ...(value ? { mine: "1" } : {}) } }}
                aria-current={value === mine ? "page" : undefined}
                className={chip}
              >
                {value ? t("mine") : t("everyone")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <StaffTicketList tickets={loaded.data.items} empty={t("empty")} />
    </div>
  );
}
