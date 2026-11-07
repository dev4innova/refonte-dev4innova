"use server";

import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { type ContentFormat, DOCUMENT_MAX_BYTES, type Length, type Tone } from "@/lib/ai-experiences";

/*
 * AI experiences Server Actions (TASK-083 to TASK-087). The API checks membership and
 * that sessions belong to the signed-in user.
 */

export type ExperienceError =
  | "signin"
  | "notFound"
  | "documentType"
  | "documentEmpty"
  | "documentEncrypted"
  | "documentUnreadable"
  | "documentTooLarge"
  | "documentTooLong"
  | "dailyLimit"
  | "rateLimited"
  | "validation"
  | "generic";

export type ExperienceResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ExperienceError };

type ApiError = { error?: { code?: string; details?: Record<string, unknown> } } | undefined;

const DOCUMENT_REASONS: Record<string, ExperienceError> = {
  type: "documentType",
  empty: "documentEmpty",
  encrypted: "documentEncrypted",
  unreadable: "documentUnreadable",
  too_large: "documentTooLarge",
  too_long: "documentTooLong",
};

function errorFrom(status: number, body: unknown): ExperienceResult<never> {
  const error = (body as ApiError)?.error;
  if (status === 401) return { ok: false, error: "signin" };
  if (status === 403 || status === 404) return { ok: false, error: "notFound" };
  if (status === 429) return { ok: false, error: error?.code === "ai_daily_limit" ? "dailyLimit" : "rateLimited" };
  if (status === 422) {
    const reason = error?.details?.reason;
    return { ok: false, error: (typeof reason === "string" && DOCUMENT_REASONS[reason]) || "validation" };
  }
  return { ok: false, error: "generic" };
}

async function api() {
  const session = await getSession();
  return session ? serverApi(session.accessToken) : null;
}

const SIGNIN: ExperienceResult<never> = { ok: false, error: "signin" };

export async function createAssistantSession(org: string): Promise<ExperienceResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.POST("/api/v1/organizations/{organization_id}/ai/sessions", {
    params: { path: { organization_id: org } },
    body: { title: "" },
  });
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}

export async function uploadDocument(org: string, formData: FormData): Promise<ExperienceResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "documentEmpty" };
  if (file.size > DOCUMENT_MAX_BYTES) return { ok: false, error: "documentTooLarge" };
  const body = new FormData();
  body.set("file", file, file.name);
  const { data, response, error } = await client.POST("/api/v1/organizations/{organization_id}/ai/documents", {
    params: { path: { organization_id: org } },
    // Multipart: let fetch set the boundary.
    body: body as never,
    bodySerializer: () => body,
  });
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}

export type ContentInput = {
  format: ContentFormat;
  tone: Tone;
  language: "fr" | "en";
  length: Length;
  topic: string;
  details: string;
};

export async function createContentSession(
  org: string,
  input: ContentInput,
): Promise<ExperienceResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (input.topic.trim().length < 3) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/ai/sessions/content",
    { params: { path: { organization_id: org } }, body: { ...input, topic: input.topic.trim(), details: input.details.trim() } },
  );
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}

export async function renameSession(org: string, id: string, title: string): Promise<ExperienceResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!title.trim()) return { ok: false, error: "validation" };
  const { response, error } = await client.PATCH(
    "/api/v1/organizations/{organization_id}/ai/sessions/{session_id}",
    { params: { path: { organization_id: org, session_id: id } }, body: { title: title.trim() } },
  );
  return response.ok ? { ok: true, data: undefined } : errorFrom(response.status, error);
}

export async function deleteSession(org: string, id: string): Promise<ExperienceResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE(
    "/api/v1/organizations/{organization_id}/ai/sessions/{session_id}",
    { params: { path: { organization_id: org, session_id: id } } },
  );
  return response.status === 204 ? { ok: true, data: undefined } : errorFrom(response.status, error);
}

export async function deleteAllSessions(org: string): Promise<ExperienceResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/organizations/{organization_id}/ai/sessions", {
    params: { path: { organization_id: org } },
  });
  return response.status === 204 ? { ok: true, data: undefined } : errorFrom(response.status, error);
}
