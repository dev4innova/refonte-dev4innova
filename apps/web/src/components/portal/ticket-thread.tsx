import { getFormatter, getTranslations } from "next-intl/server";

import type { TicketDetail } from "@/lib/portal";
import { cn } from "@/lib/utils";

/** Messages of a support ticket, oldest first; the team's replies are set apart. */
export async function TicketThread({ ticket }: { ticket: TicketDetail }) {
  const [t, format] = await Promise.all([getTranslations("Portal"), getFormatter()]);
  return (
    <section aria-labelledby="ticket-thread" className="flex flex-col gap-4">
      <h2 id="ticket-thread" className="text-heading-sm font-semibold">{t("ticket.thread")}</h2>
      <ol className="flex flex-col gap-4">
        {ticket.thread.map((message) => (
          <li
            key={message.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-4",
              message.from_staff ? "border-primary/30 bg-accent/40 sm:ml-10" : "border-border bg-card sm:mr-10",
            )}
          >
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {message.author?.display_name ?? message.author?.email ?? t("deletedUser")}
              </span>
              {message.from_staff ? <> · {t("team")}</> : null} ·{" "}
              {format.dateTime(new Date(message.created_at), { dateStyle: "medium", timeStyle: "short" })}
            </p>
            <p className="whitespace-pre-line">{message.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
