import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { StatusChip } from "@/components/portal/status-chip";
import { TicketThread } from "@/components/portal/ticket-thread";
import { StaffReplyForm, TicketSettingsForm } from "@/components/portal-admin/ticket-controls";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; id: string }> };

/** A support request in the back office: conversation, answer, follow-up (TASK-101). */
export default function PortalTicketAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalTicketAdmin params={params} />
    </Suspense>
  );
}

async function PortalTicketAdmin({ params }: Props) {
  const { locale, id } = await params;
  if (!isUuid(id)) notFound();
  const loaded = await adminLoad(getPathname({ locale, href: { pathname: "/admin/portal/support/[id]", params: { id } } }), async (api) => {
    const [ticket, team] = await Promise.all([
      api.GET("/api/v1/admin/portal/tickets/{ticket_id}", { params: { path: { ticket_id: id } } }),
      api.GET("/api/v1/admin/portal/team"),
    ]);
    return { data: ticket.data && team.data ? { ticket: ticket.data, team: team.data } : undefined, response: ticket.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tp, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.portal.support" }),
    getTranslations({ locale, namespace: "Portal" }),
    getFormatter({ locale }),
  ]);
  const { ticket, team } = loaded.data;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/admin/portal/support" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {tp("support.number", { number: ticket.number })} · {t("client", { name: ticket.organization.name })}
        </p>
        <h1 className="text-heading-lg font-semibold break-words">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip value={ticket.status} label={tp(`ticketStatus.${ticket.status}`)} />
          <StatusChip value={ticket.priority} label={tp(`priority.${ticket.priority}`)} />
          <span className="text-sm text-muted-foreground">{tp(`category.${ticket.category}`)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {tp("ticket.openedBy", {
            name: ticket.created_by?.display_name ?? ticket.created_by?.email ?? tp("deletedUser"),
            date: format.dateTime(new Date(ticket.created_at), { dateStyle: "medium" }),
          })}
          {ticket.project ? (
            <>
              {" · "}
              <Link
                href={{ pathname: "/admin/portal/projects/[id]", params: { id: ticket.project.id } }}
                className="text-primary-ink underline-offset-4 hover:underline"
              >
                {tp("ticket.project", { name: ticket.project.name })}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <TicketThread ticket={ticket} />
          <StaffReplyForm ticketId={ticket.id} />
        </div>
        <aside aria-labelledby="ticket-settings" className="flex flex-col gap-4 self-start rounded-xl border border-border bg-card p-5">
          <h2 id="ticket-settings" className="text-heading-sm font-semibold">{t("settings")}</h2>
          <TicketSettingsForm ticket={ticket} team={team} />
        </aside>
      </div>
    </div>
  );
}
