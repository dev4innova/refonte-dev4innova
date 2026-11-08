import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PortalHeader } from "@/components/portal/portal-header";
import { StatusChip } from "@/components/portal/status-chip";
import { TicketReplyForm } from "@/components/portal/ticket-forms";
import { TicketThread } from "@/components/portal/ticket-thread";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { portalContext } from "@/lib/portal-server";

type Props = { params: Promise<{ locale: Locale; org: string; ticket: string }> };

/** A support request and its conversation with the team (TASK-101). */
export default function PortalTicketPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalTicket params={params} />
    </Suspense>
  );
}

async function PortalTicket({ params }: Props) {
  const { locale, org, ticket: ticketId } = await params;
  const { membership, api } = await portalContext(
    locale,
    { pathname: "/account/portal/[org]/support/[ticket]", params: { org, ticket: ticketId } },
    org,
  );
  const { data: ticket, response } = await api
    .GET("/api/v1/organizations/{organization_id}/portal/tickets/{ticket_id}", {
      params: { path: { organization_id: org, ticket_id: ticketId } },
    })
    .catch(() => ({ data: undefined, response: undefined }));
  if (response?.status === 404 || response?.status === 422) notFound();
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "Portal" }), getFormatter({ locale })]);

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} />
      <Link
        href={{ pathname: "/account/portal/[org]/support", params: { org } }}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("ticket.back")}
      </Link>
      {!ticket ? (
        <p role="alert" className="text-destructive">{t("errors.load")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">{t("support.number", { number: ticket.number })}</p>
            <h1 className="text-heading-lg font-semibold break-words">{ticket.subject}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip value={ticket.status} label={t(`ticketStatus.${ticket.status}`)} />
              <StatusChip value={ticket.priority} label={t(`priority.${ticket.priority}`)} />
              <span className="text-sm text-muted-foreground">{t(`category.${ticket.category}`)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("ticket.openedBy", {
                name: ticket.created_by?.display_name ?? ticket.created_by?.email ?? t("deletedUser"),
                date: format.dateTime(new Date(ticket.created_at), { dateStyle: "medium" }),
              })}
              {ticket.project ? <> · {t("ticket.project", { name: ticket.project.name })}</> : null}
            </p>
          </div>
          <div className="flex max-w-3xl flex-col gap-8">
            <TicketThread ticket={ticket} />
            <TicketReplyForm org={org} ticketId={ticket.id} closed={ticket.status === "closed"} />
          </div>
        </>
      )}
    </>
  );
}
