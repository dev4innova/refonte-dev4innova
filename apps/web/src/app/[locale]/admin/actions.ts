"use server";

import { updateTag } from "next/cache";

import type { components } from "@dev4innova/api-client";
import { type AdminDocument, adminApi, type DocumentType } from "@/lib/admin";
import { getSession } from "@/lib/auth/session";
import { cmsTag } from "@/lib/cms";

/*
 * Back-office Server Actions (TASK-060 to TASK-066). The API enforces staff access and
 * roles; these actions forward the user's token, then refresh the website cache so a
 * published change is visible immediately (updateTag = read-your-own-writes).
 */

export type ActionError =
  | "signin"
  | "forbidden"
  | "slug"
  | "missingLocale"
  | "publishedDelete"
  | "validation"
  | "invalidImage"
  | "tooLarge"
  | "generic";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

type TranslationIn = components["schemas"]["TranslationIn"];

export type DocumentInput = {
  type: DocumentType;
  translations: Partial<Record<"fr" | "en", TranslationIn>>;
  attributes: Record<string, string>;
  position: number;
  coverMediaId: string | null;
};

const ALL_TYPES: DocumentType[] = ["article", "project", "service", "page"];

async function api() {
  const session = await getSession();
  return session ? adminApi(session) : null;
}

function errorFrom(status: number, body: unknown): ActionError {
  if (status === 401) return "signin";
  if (status === 403 || status === 404) return "forbidden";
  if (status === 409) {
    const message = (body as { error?: { message?: string } })?.error?.message ?? "";
    return message.toLowerCase().includes("unpublish") ? "publishedDelete" : "slug";
  }
  if (status === 422) {
    const details = (body as { error?: { details?: Record<string, unknown> } })?.error?.details;
    if (details && "missing_locales" in details) return "missingLocale";
    return "validation";
  }
  return "generic";
}

function refresh(type: DocumentType) {
  updateTag(cmsTag(type));
}

/** Only filled-in languages are sent: a document may stay French-only while drafted. */
function filledTranslations(input: DocumentInput) {
  return Object.fromEntries(
    Object.entries(input.translations).filter(([, t]) => t && (t.title.trim() || t.slug.trim())),
  ) as Record<"fr" | "en", TranslationIn>;
}

export async function saveDocument(
  id: string | null,
  input: DocumentInput,
): Promise<ActionResult<AdminDocument>> {
  const client = await api();
  if (!client) return { ok: false, error: "signin" };
  const translations = filledTranslations(input);
  const result = id
    ? await client.PATCH("/api/v1/admin/cms/documents/{document_id}", {
        params: { path: { document_id: id } },
        body: {
          translations,
          attributes: input.attributes,
          position: input.position,
          cover_media_id: input.coverMediaId,
          clear_cover: input.coverMediaId === null,
        },
      })
    : await client.POST("/api/v1/admin/cms/documents", {
        body: {
          type: input.type,
          translations,
          attributes: input.attributes,
          position: input.position,
          cover_media_id: input.coverMediaId,
        },
      });
  if (!result.data) return { ok: false, error: errorFrom(result.response.status, result.error) };
  refresh(input.type);
  return { ok: true, data: result.data };
}

export async function setPublished(
  id: string,
  type: DocumentType,
  published: boolean,
): Promise<ActionResult<AdminDocument>> {
  const client = await api();
  if (!client) return { ok: false, error: "signin" };
  const path = published
    ? "/api/v1/admin/cms/documents/{document_id}/publish"
    : "/api/v1/admin/cms/documents/{document_id}/unpublish";
  const result = await client.POST(path, { params: { path: { document_id: id } } });
  if (!result.data) return { ok: false, error: errorFrom(result.response.status, result.error) };
  refresh(type);
  return { ok: true, data: result.data };
}

export async function deleteDocument(id: string, type: DocumentType): Promise<ActionResult> {
  const client = await api();
  if (!client) return { ok: false, error: "signin" };
  const { response, error } = await client.DELETE("/api/v1/admin/cms/documents/{document_id}", {
    params: { path: { document_id: id } },
  });
  if (response.status !== 204) return { ok: false, error: errorFrom(response.status, error) };
  refresh(type);
  return { ok: true, data: undefined };
}

export async function previewMarkdown(bodyMd: string): Promise<ActionResult<string>> {
  const client = await api();
  if (!client) return { ok: false, error: "signin" };
  const { data, response, error } = await client.POST("/api/v1/admin/cms/preview", {
    body: { body_md: bodyMd },
  });
  if (!data) return { ok: false, error: errorFrom(response.status, error) };
  return { ok: true, data: data.html };
}

export async function uploadMedia(formData: FormData): Promise<ActionResult> {
  const client = await api();
  if (!client) return { ok: false, error: "signin" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "invalidImage" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "tooLarge" };

  const body = new FormData();
  body.set("file", file, file.name);
  const { response } = await client.POST("/api/v1/admin/cms/media", {
    // Multipart: let fetch set the boundary.
    body: body as never,
    bodySerializer: () => body,
  });
  if (response.status === 201) return { ok: true, data: undefined };
  if (response.status === 422) return { ok: false, error: "invalidImage" };
  return { ok: false, error: errorFrom(response.status, null) };
}

export async function updateMediaAlt(
  id: string,
  altFr: string,
  altEn: string,
): Promise<ActionResult> {
  const client = await api();
  if (!client) return { ok: false, error: "signin" };
  const { response, error } = await client.PATCH("/api/v1/admin/cms/media/{media_id}", {
    params: { path: { media_id: id } },
    body: { alt_fr: altFr, alt_en: altEn },
  });
  if (response.status !== 200) return { ok: false, error: errorFrom(response.status, error) };
  ALL_TYPES.forEach(refresh); // alternative texts appear wherever the image is a cover
  return { ok: true, data: undefined };
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const client = await api();
  if (!client) return { ok: false, error: "signin" };
  const { response, error } = await client.DELETE("/api/v1/admin/cms/media/{media_id}", {
    params: { path: { media_id: id } },
  });
  if (response.status !== 204) return { ok: false, error: errorFrom(response.status, error) };
  ALL_TYPES.forEach(refresh);
  return { ok: true, data: undefined };
}
