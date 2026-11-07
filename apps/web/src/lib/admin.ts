import "server-only";

import type { components } from "@dev4innova/api-client";
import { cache } from "react";

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

/** The internal DEV4INNOVA organization, whose members are staff (ADR-0006). */
export const INTERNAL_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

export type StaffRole = "staff_admin" | "staff_editor" | "staff_sales";

/** What the back office shows to a staff role. The API enforces the same rules (403);
 * this only hides what the role cannot use. */
export type StaffAccess = { content: boolean; contentWrite: boolean; crm: boolean; crmDelete: boolean };

export function staffAccess(role: StaffRole | null): StaffAccess {
  return {
    content: role !== null,
    contentWrite: role === "staff_admin" || role === "staff_editor",
    crm: role === "staff_admin" || role === "staff_sales",
    crmDelete: role === "staff_admin",
  };
}

/** Staff role of the signed-in user, once per request; null if not staff or unknown. */
export const getStaffRole = cache(async (accessToken: string): Promise<StaffRole | null> => {
  try {
    const { data } = await serverApi(accessToken).GET("/api/v1/me");
    const role = data?.memberships.find((m) => m.organization_id === INTERNAL_ORGANIZATION_ID)?.role;
    return role === "staff_admin" || role === "staff_editor" || role === "staff_sales" ? role : null;
  } catch {
    return null;
  }
});

type AdminApi = ReturnType<typeof adminApi>;

/**
 * Loads the data of a back-office page: redirects to sign-in when needed, and tells the
 * page to show a notice when the API refuses access or is unreachable.
 */
export async function adminLoad<T>(
  returnTo: string,
  load: (api: AdminApi) => Promise<{ data?: T; response: Response }>,
): Promise<{ ok: true; data: T; session: Session } | { ok: false; notice: "forbidden" | "unavailable" }> {
  const session = await requireSession(returnTo);
  const result = await load(adminApi(session)).catch(() => null);
  const status = result ? accessStatus(result.response.status) : "unavailable";
  if (status === "signin") redirectToLogin(returnTo);
  if (status !== "ok" || result?.data === undefined) {
    return { ok: false, notice: status === "forbidden" ? "forbidden" : "unavailable" };
  }
  return { ok: true, data: result.data, session };
}
