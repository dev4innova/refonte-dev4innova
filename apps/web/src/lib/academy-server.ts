import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { type Locale, routing } from "@/i18n/routing";
import { academyTag, type CourseCard, type CourseOutline } from "@/lib/academy";
import { serverApi } from "@/lib/api";

/* Public catalog of the Academy, cached; the back office calls updateTag("academy") after
 * each change, so a published course shows up at once. Errors are never cached. */

async function fetchCatalog(locale: Locale): Promise<CourseCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(academyTag);
  const { data, response } = await serverApi().GET("/api/v1/academy/courses", { params: { query: { locale } } });
  if (!data) throw new Error(`Academy catalog failed: ${response.status}`);
  return data;
}

async function fetchCourse(locale: Locale, slug: string): Promise<CourseOutline | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(academyTag);
  const { data, response } = await serverApi().GET("/api/v1/academy/courses/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  if (response.status === 404 || response.status === 422) return null;
  if (!data) throw new Error(`Academy course failed: ${response.status}`);
  return data;
}

export async function getCatalog(locale: Locale): Promise<CourseCard[] | null> {
  if (!routing.locales.includes(locale)) return [];
  try {
    return await fetchCatalog(locale);
  } catch {
    return null;
  }
}

export async function getCourse(locale: Locale, slug: string): Promise<CourseOutline | null> {
  if (!routing.locales.includes(locale) || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  try {
    return await fetchCourse(locale, slug);
  } catch {
    return null;
  }
}
