import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PortalHeader } from "@/components/portal/portal-header";
import { StatusChip } from "@/components/portal/status-chip";
import { NewTicketForm } from "@/components/portal/ticket-forms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { TICKET_FILTERS, ticketFilter } from "@/lib/portal";
import { portalContext } from "@/lib/portal-server";

type Props = {
  params: Promise<{ locale: Locale; org: string }>;
  searchParams: Promise<{ state?: string | string[] }>;
};

/** Support requests of the organization, and a form to open one (TASK-101). */
export default function PortalSupportPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalSupport {...props} />
    </Suspense>
  );
}

async function PortalSupport({ params, searchParams }: Props) {
  const { locale, org } = await params;
  const state = ticketFilter((await searchParams).state);
  const { membership, api } = await portalContext(locale, { pathname: "/account/portal/[org]/support", params: { org } }, org);
  const [t, format, tickets, projects] = await Promise.all([
    getTranslations({ locale, namespace: "Portal" }),
    getFormatter({ locale }),
    api
      .GET("/api/v1/organizations/{organization_id}/portal/tickets", {
        params: { path: { organization_id: org }, query: { state } },
      })
      .then((r) => r.data)
      .catch(() => undefined),
    api
      .GET("/api/v1/organizations/{organization_id}/portal/projects", { params: { path: { organization_id: org } } })
      .then((r) => r.data)
      .catch(() => undefined),
  ]);

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} role={membership.role} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("support.title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("support.lead")}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="support-list" className="flex min-w-0 flex-col gap-4">
          <h2 id="support-list" className="sr-only">{t("support.title")}</h2>
          <nav aria-label={t("support.filters.label")}>
            <ul className="flex flex-wrap gap-2">
              {TICKET_FILTERS.map((filter) => (
                <li key={filter}>
                  <Link
                    href={{ pathname: "/account/portal/[org]/support", params: { org }, query: { state: filter } }}
                    aria-current={filter === state ? "page" : undefined}
                    className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted aria-[current=page]:border-secondary aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
                  >
                    {t(`support.filters.${filter}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {!tickets ? (
            <p role="alert" className="text-destructive">{t("errors.load")}</p>
          ) : tickets.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-input bg-card p-8 text-center text-muted-foreground">{t("support.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
              {tickets.items.map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={{ pathname: "/account/portal/[org]/support/[ticket]", params: { org, ticket: ticket.id } }}
                      className="font-medium break-words underline-offset-4 hover:text-primary hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {t("support.number", { number: ticket.number })} · {t(`category.${ticket.category}`)} ·{" "}
                      {t("support.messages", { count: ticket.messages })} ·{" "}
                      {t("support.updated", { date: format.dateTime(new Date(ticket.last_message_at), { dateStyle: "medium" }) })}
                    </span>
                    {ticket.status === "waiting_customer" ? (
                      <span className="text-xs font-semibold text-primary">{t("support.awaitingYou")}</span>
                    ) : null}
                  </div>
                  <StatusChip value={ticket.status} label={t(`ticketStatus.${ticket.status}`)} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="support-new" className="flex flex-col gap-4 self-start rounded-xl border border-border bg-card p-5">
          <h2 id="support-new" className="text-heading-sm font-semibold">{t("support.new.title")}</h2>
          <NewTicketForm org={org} projects={(projects?.items ?? []).map((p) => ({ id: p.id, name: p.name }))} />
        </section>
      </div>
    </>
  );
}
