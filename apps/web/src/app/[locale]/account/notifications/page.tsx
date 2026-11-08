import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NotificationList } from "@/components/portal/notification-list";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireSession } from "@/lib/admin";
import { serverApi } from "@/lib/api";

type Props = { params: Promise<{ locale: Locale }> };

/** In-app notifications of the signed-in user, for every organization (TASK-102). */
export default function NotificationsPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Notifications params={params} />
    </Suspense>
  );
}

async function Notifications({ params }: Props) {
  const { locale } = await params;
  const session = await requireSession(getPathname({ locale, href: "/account/notifications" }));
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: "Portal" }),
    serverApi(session.accessToken)
      .GET("/api/v1/me/notifications", { params: { query: { page_size: 50 } } })
      .then((r) => r.data)
      .catch(() => undefined),
  ]);
  return (
    <>
      <Link href="/account" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("notifications.title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("notifications.lead")}</p>
      </div>
      <div className="max-w-3xl">
        {!page ? (
          <p role="alert" className="text-destructive">{t("errors.load")}</p>
        ) : (
          <NotificationList items={page.items} unread={page.unread} />
        )}
      </div>
    </>
  );
}
