"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { replyTicket, updateTicket } from "@/app/[locale]/admin/portal/actions";
import { usePortalAction } from "@/components/portal/use-portal-action";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  type Person,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/portal";

/** The team's answer, with the status the ticket takes afterwards (TASK-101). */
export function StaffReplyForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("Admin.portal.support");
  const tp = useTranslations("Portal");
  const { pending, error, run } = usePortalAction();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<TicketStatus>("waiting_customer");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => replyTicket(ticketId, body, status), () => setBody(""));
      }}
    >
      <FormField label={t("reply")}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} required maxLength={10000} rows={5} />
      </FormField>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label={t("statusAfter")}>
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{tp(`ticketStatus.${s}`)}</option>)}
          </NativeSelect>
        </FormField>
        <Button type="submit" loading={pending}>{t("send")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}

/** Status, priority and owner of a ticket. */
export function TicketSettingsForm({ ticket, team }: { ticket: TicketDetail; team: Person[] }) {
  const t = useTranslations("Admin.portal.support");
  const tp = useTranslations("Portal");
  const { pending, error, run } = usePortalAction();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        run(
          () =>
            updateTicket(ticket.id, {
              status: String(data.get("status")) as TicketStatus,
              priority: String(data.get("priority")) as TicketPriority,
              assigneeId: String(data.get("assignee") ?? ""),
            }),
          () => setSaved(true),
        );
      }}
    >
      <FormField label={t("status")}>
        <NativeSelect name="status" defaultValue={ticket.status}>
          {TICKET_STATUSES.map((s) => <option key={s} value={s}>{tp(`ticketStatus.${s}`)}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label={t("priority")}>
        <NativeSelect name="priority" defaultValue={ticket.priority}>
          {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{tp(`priority.${p}`)}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label={t("owner")}>
        <NativeSelect name="assignee" defaultValue={ticket.assignee?.id ?? ""}>
          <option value="">{t("unassigned")}</option>
          {team.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.email}</option>)}
        </NativeSelect>
      </FormField>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("save")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("saved")}</p> : null}
    </form>
  );
}
