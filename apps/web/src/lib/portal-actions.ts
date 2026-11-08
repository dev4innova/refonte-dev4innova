import "server-only";

import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { FILE_MAX_BYTES } from "@/lib/portal";

/* Shared plumbing of the portal Server Actions (client portal and back office). */

export type PortalError =
  | "signin"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "validation"
  | "fileType"
  | "fileEmpty"
  | "fileTooLarge"
  | "fileUnreadable"
  | "generic";

export type PortalResult<T = undefined> = { ok: true; data: T } | { ok: false; error: PortalError };

type ApiError = { error?: { details?: Record<string, unknown> } } | undefined;

const FILE_REASONS: Record<string, PortalError> = {
  unsupported_type: "fileType",
  empty: "fileEmpty",
  too_large: "fileTooLarge",
  unreadable: "fileUnreadable",
};

export function errorFrom(status: number, body: unknown): PortalResult<never> {
  if (status === 401) return { ok: false, error: "signin" };
  if (status === 403) return { ok: false, error: "forbidden" };
  if (status === 404) return { ok: false, error: "notFound" };
  if (status === 409) return { ok: false, error: "conflict" };
  if (status === 422) {
    const reason = (body as ApiError)?.error?.details?.reason;
    return { ok: false, error: (typeof reason === "string" && FILE_REASONS[reason]) || "validation" };
  }
  return { ok: false, error: "generic" };
}

export const SIGNIN: PortalResult<never> = { ok: false, error: "signin" };
export const DONE: PortalResult = { ok: true, data: undefined };

export async function api() {
  const session = await getSession();
  return session ? serverApi(session.accessToken) : null;
}

/** The file of a form, checked like the API does before it is sent. */
export function fileOf(formData: FormData): File | PortalError {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "fileEmpty";
  if (file.size > FILE_MAX_BYTES) return "fileTooLarge";
  return file;
}

/** Multipart body for openapi-fetch: fetch sets the boundary. */
export function multipart(fields: Record<string, string | File | null | undefined>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof File) body.set(key, value, value.name);
    else if (value) body.set(key, value);
  }
  return { body: body as never, bodySerializer: () => body };
}

/** Text of a form field, trimmed. */
export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
