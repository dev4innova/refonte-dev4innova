"use client";

import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { markAllNotificationsRead, markNotificationRead } from "@/app/[locale]/account/portal/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { notificationHref, notificationValues, type PortalNotification } from "@/lib/portal";
import { cn } from "@/lib/utils";

import { usePortalAction } from "./use-portal-action";

/** The user's notifications (TASK-102): opening one marks it read. */
export function NotificationList({ items, unread }: { items: PortalNotification[]; unread: number }) {
  const t = useTranslations("Portal.notifications");
  const format = useFormatter();
  const { pending, error, run } = usePortalAction();

  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-input bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {unread > 0 ? (
        <div>
          <Button type="button" size="sm" variant="outline" loading={pending} onClick={() => run(markAllNotificationsRead)}>
            {t("markAll")}
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((n) => (
          <li key={n.id} className={cn("flex items-start gap-3 p-4", !n.read && "bg-accent/30")}>
            <Bell aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", n.read ? "text-muted-foreground" : "text-primary")} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={notificationHref(n)}
                onClick={() => {
                  if (!n.read) void markNotificationRead(n.id);
                }}
                className={cn("underline-offset-4 hover:text-primary hover:underline", !n.read && "font-semibold")}
              >
                {t(`types.${n.type}`, notificationValues(n))}
              </Link>
              <span className="text-xs text-muted-foreground">
                {!n.read ? <>{t("unread")} · </> : null}
                {n.organization.name} · {format.dateTime(new Date(n.created_at), { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            {!n.read ? (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markNotificationRead(n.id))}>
                {t("markRead")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
