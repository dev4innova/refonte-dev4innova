import "server-only";

import { notFound } from "next/navigation";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getMembership } from "@/lib/ai-experiences-server";
import { serverApi } from "@/lib/api";
import { INTERNAL_ORGANIZATION_ID } from "@/lib/admin";

type PortalHref = Parameters<typeof getPathname>[0]["href"];

/**
 * Context of a client portal page: the signed-in member of a client organization (sign-in
 * redirect otherwise, 404 if not a member) and an API client with their token.
 */
export async function portalContext(locale: Locale, href: PortalHref, org: string) {
  const { session, membership } = await getMembership(getPathname({ locale, href }), org);
  if (!membership || org === INTERNAL_ORGANIZATION_ID) notFound();
  return { membership, api: serverApi(session.accessToken) };
}

/** Unread notifications of the signed-in user (0 if unknown). */
export async function unreadNotifications(accessToken: string): Promise<number> {
  const { data } = await serverApi(accessToken)
    .GET("/api/v1/me/notifications/unread")
    .catch(() => ({ data: undefined }));
  return data?.unread ?? 0;
}
