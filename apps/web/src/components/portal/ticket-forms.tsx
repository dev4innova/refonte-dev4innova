"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { closeTicket, createTicket, replyTicket, type TicketInput } from "@/app/[locale]/account/portal/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/portal";

import { usePortalAction } from "./use-portal-action";

/** Opens a support ticket, then shows it (TASK-101). */
export function NewTicketForm({ org, projects }: { org: string; projects: { id: string; name: string }[] }) {
  const t = useTranslations("Portal");
  const router = useRouter();
  const { pending, error, run } = usePortalAction();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        const input = {
          subject: text("subject"),
          category: text("category"),
          priority: text("priority"),
          projectId: text("project"),
          message: text("message"),
        } as TicketInput;
        run(() => createTicket(org, input), ({ id }) =>
          router.push({ pathname: "/account/portal/[org]/support/[ticket]", params: { org, ticket: id } }),
        );
      }}
    >
      <FormField label={t("support.new.subject")} required requiredLabel={t("required")}>
        <Input name="subject" required minLength={4} maxLength={200} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("support.new.category")}>
          <NativeSelect name="category" defaultValue="question">
            {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t("support.new.priority")}>
          <NativeSelect name="priority" defaultValue="normal">
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      {projects.length > 0 ? (
        <FormField label={t("support.new.project")}>
          <NativeSelect name="project" defaultValue="">
            <option value="">{t("support.new.noProject")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
        </FormField>
      ) : null}
      <FormField label={t("support.new.message")} description={t("support.new.messageHelp")} required requiredLabel={t("required")}>
        <Textarea name="message" required minLength={10} maxLength={10000} rows={6} />
      </FormField>
      <div>
        <Button type="submit" loading={pending}>{t("support.new.submit")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}

/** The client's answer on a ticket; closing is offered while the ticket is not closed. */
export function TicketReplyForm({ org, ticketId, closed }: { org: string; ticketId: string; closed: boolean }) {
  const t = useTranslations("Portal.ticket");
  const reply = usePortalAction();
  const close = usePortalAction();
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {closed ? <p className="rounded-lg bg-muted p-4 text-sm">{t("closed")}</p> : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          reply.run(() => replyTicket(org, ticketId, body), () => setBody(""));
        }}
      >
        <FormField label={t("reply")}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} required maxLength={10000} rows={4} />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={reply.pending}>{t("send")}</Button>
          {closed ? null : (
            <Button
              type="button"
              variant="outline"
              loading={close.pending}
              onClick={() => {
                if (window.confirm(t("closeConfirm"))) close.run(() => closeTicket(org, ticketId));
              }}
            >
              {t("close")}
            </Button>
          )}
        </div>
        {reply.error || close.error ? (
          <p role="alert" className="text-sm font-medium text-destructive">{reply.error ?? close.error}</p>
        ) : null}
      </form>
    </div>
  );
}
