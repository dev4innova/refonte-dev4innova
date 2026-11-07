import "server-only";

import type { components } from "@dev4innova/api-client";
import { cacheLife, cacheTag } from "next/cache";

import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";

/*
 * Published CMS content for the website (EPIC 06).
 *
 * - Cached with `use cache` and the tag `cms:<type>`; the back office calls updateTag()
 *   after each change, so edits show up immediately.
 * - Errors are thrown inside the cached scope (never cached) and turned into "no content"
 *   outside it: the next request retries.
 * - Callers render this content inside <Suspense> after `connection()`, so a build without
 *   API (CI, Docker image) never freezes an empty page.
 */

export type ContentType = components["schemas"]["PublicContentSummary"]["type"];
export type ContentSummary = components["schemas"]["PublicContentSummary"];
export type Content = components["schemas"]["PublicContent"];

export const cmsTag = (type: ContentType) => `cms:${type}`;

async function fetchList(type: ContentType, locale: Locale): Promise<ContentSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cmsTag(type));

  const { data, response } = await serverApi().GET("/api/v1/content/{document_type}", {
    params: { path: { document_type: type }, query: { locale } },
  });
  if (!data) throw new Error(`CMS list ${type} failed: ${response.status}`);
  return data;
}

async function fetchOne(
  type: ContentType,
  locale: Locale,
  slug: string,
): Promise<Content | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(cmsTag(type));

  const { data, response } = await serverApi().GET("/api/v1/content/{document_type}/{slug}", {
    params: { path: { document_type: type, slug }, query: { locale } },
  });
  if (response.status === 404) return null;
  if (!data) throw new Error(`CMS content ${type}/${slug} failed: ${response.status}`);
  return data;
}

/** Published contents of a type, in display order. Empty when the API is unavailable. */
export async function getContentList(type: ContentType, locale: Locale): Promise<ContentSummary[]> {
  try {
    return await fetchList(type, locale);
  } catch {
    return [];
  }
}

/** A published content, by its slug in `locale` or in another locale (language switch). */
export async function getContent(
  type: ContentType,
  locale: Locale,
  slug: string,
): Promise<Content | null> {
  try {
    return await fetchOne(type, locale, slug);
  } catch {
    return null;
  }
}
