import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { MediaManager } from "@/components/admin/media-manager";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { accessStatus, adminApi, requireSession } from "@/lib/admin";
import { redirectToLogin } from "@/lib/auth/redirect";

type Props = { params: Promise<{ locale: Locale }> };

/** Media library (TASK-065). */
export default function MediaPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Media params={params} />
    </Suspense>
  );
}

async function Media({ params }: Props) {
  const { locale } = await params;
  const returnTo = getPathname({ locale, href: "/admin/media" });
  const session = await requireSession(returnTo);
  const result = await adminApi(session).GET("/api/v1/admin/cms/media").catch(() => null);
  const status = result ? accessStatus(result.response.status) : "unavailable";
  if (status === "signin") redirectToLogin(returnTo);
  if (status !== "ok") return <AdminNotice locale={locale} kind={status} />;
  return <MediaManager media={result?.data ?? []} />;
}
