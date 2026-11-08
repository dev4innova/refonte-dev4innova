"use server";

import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { fieldsFromApiError, forwardedForHeader } from "@/lib/client-ip";
import { UNLOCK_FIELDS } from "@/lib/diagnostic";

/* Public diagnostic Server Actions (TASK-089, TASK-093, TASK-095). */

export type DiagnosticError = "incomplete" | "rateLimited" | "unavailable" | "notFound" | "validation";
export type DiagnosticActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: DiagnosticError; fields?: string[] };

export async function submitDiagnostic(
  locale: Locale,
  answers: Record<string, string>,
  profile: Record<string, string>,
  website: string,
): Promise<DiagnosticActionResult<{ token: string }>> {
  try {
    const { data, response } = await serverApi().POST("/api/v1/diagnostic", {
      body: { locale, answers, profile, website },
      headers: await forwardedForHeader(),
    });
    if (data) return { ok: true, data: { token: data.token } };
    if (response.status === 429) return { ok: false, error: "rateLimited" };
    if (response.status === 422) return { ok: false, error: "incomplete" };
  } catch {
    // handled below
  }
  return { ok: false, error: "unavailable" };
}

export async function unlockDiagnostic(token: string, formData: FormData): Promise<DiagnosticActionResult> {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const fields: string[] = [];
  if (text("name").trim().length < 2) fields.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text("email").trim())) fields.push("email");
  if (text("consent") !== "on") fields.push("consent");
  if (fields.length) return { ok: false, error: "validation", fields };
  try {
    const { response, error } = await serverApi().POST("/api/v1/diagnostic/unlock", {
      params: { query: { token } },
      body: {
        name: text("name").trim(),
        email: text("email").trim(),
        company: text("company").trim() || null,
        consent: true,
        website: text("website"),
      },
      headers: await forwardedForHeader(),
    });
    if (response.ok) return { ok: true, data: undefined };
    if (response.status === 404) return { ok: false, error: "notFound" };
    if (response.status === 429) return { ok: false, error: "rateLimited" };
    if (response.status === 422) {
      return { ok: false, error: "validation", fields: fieldsFromApiError(error, UNLOCK_FIELDS) };
    }
  } catch {
    // handled below
  }
  return { ok: false, error: "unavailable" };
}
