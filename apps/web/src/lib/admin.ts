import "server-only";

import type { components } from "@dev4innova/api-client";

import { serverApi } from "@/lib/api";
import { redirectToLogin } from "@/lib/auth/redirect";
import { getSession, type Session } from "@/lib/auth/session";

/* Back office (EPIC 06): every call goes to the API with the signed-in user's token; the
 * API decides who is staff (404 otherwise) and what their role allows (403). */

export const DOCUMENT_TYPES = ["article", "project", "service", "page"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type AdminDocument = components["schemas"]["DocumentOut"];
export type AdminDocumentListItem = components["schemas"]["DocumentListItem"];
export type AdminMedia = components["schemas"]["MediaOut"];

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Session of the current admin page, or a redirect to sign-in. */
export async function requireSession(returnTo: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirectToLogin(returnTo);
  return session;
}

export function adminApi(session: Session) {
  return serverApi(session.accessToken);
}

/** How an admin page should react to an API answer. */
export function accessStatus(status: number): "ok" | "forbidden" | "signin" | "unavailable" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401) return "signin";
  if (status === 403 || status === 404) return "forbidden";
  return "unavailable";
}
