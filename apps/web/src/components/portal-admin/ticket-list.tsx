import { getFormatter, getTranslations } from "next-intl/server";

import { StatusChip } from "@/components/portal/status-chip";
import { Link } from "@/i18n/navigation";
import type { TicketSummary } from "@/lib/portal";

/** Support tickets of every client, for the team. */
export async function StaffTicketList({ tickets, empty }: { tickets: TicketSummary[]; empty: string }) {
  const [t, tp, format] = await Promise.all([
    getTranslations("Admin.portal.support"),
    getTranslations("Portal"),
    getFormatter(),
  ]);
  if (tickets.length === 0) {
    return <p className="rounded-xl border border-dashed border-input bg-card p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={{ pathname: "/admin/portal/support/[id]", params: { id: ticket.id } }}
              className="font-medium break-words underline-offset-4 hover:text-primary-ink hover:underline"
            >
              {ticket.subject}
            </Link>
            <span className="text-xs text-muted-foreground">
              {tp("support.number", { number: ticket.number })} · {ticket.organization.name} ·{" "}
              {ticket.assignee ? t("assignee", { name: ticket.assignee.display_name ?? ticket.assignee.email ?? "" }) : t("unassigned")} ·{" "}
              {tp("support.updated", { date: format.dateTime(new Date(ticket.last_message_at), { dateStyle: "medium", timeStyle: "short" }) })}
            </span>
          </div>
          <span className="flex flex-wrap gap-2">
            {ticket.priority === "urgent" || ticket.priority === "high" ? (
              <StatusChip value={ticket.priority} label={tp(`priority.${ticket.priority}`)} />
            ) : null}
            <StatusChip value={ticket.status} label={tp(`ticketStatus.${ticket.status}`)} />
          </span>
        </li>
      ))}
    </ul>
  );
}
