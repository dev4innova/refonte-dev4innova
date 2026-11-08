import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import { unreadNotifications } from "@/lib/portal-server";

/** Link to the notifications with the unread count. Render inside <Suspense>. */
export async function NotificationBell() {
  const session = await getSession();
  const [t, unread] = await Promise.all([
    getTranslations("Portal.notifications"),
    session ? unreadNotifications(session.accessToken) : 0,
  ]);
  return <NotificationBellView label={t("bell", { count: unread })} unread={unread} />;
}

export function NotificationBellView({ label, unread }: { label: string; unread: number }) {
  return (
    <Link
      href="/account/notifications"
      className="relative inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors duration-fast hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Bell aria-hidden="true" className="size-5" />
      <span className="sr-only">{label}</span>
      {unread > 0 ? (
        <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
