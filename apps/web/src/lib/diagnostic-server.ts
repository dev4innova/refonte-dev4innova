import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { type Locale, routing } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import type { Questionnaire } from "@/lib/diagnostic";

async function fetchQuestionnaire(locale: Locale): Promise<Questionnaire> {
  "use cache";
  cacheLife("days");
  cacheTag("diagnostic:questionnaire");
  const { data, response } = await serverApi().GET("/api/v1/diagnostic/questionnaire", {
    params: { query: { locale } },
  });
  // Throwing keeps a failure out of the cache.
  if (!data) throw new Error(`Diagnostic questionnaire failed: ${response.status}`);
  return data;
}

/** The questionnaire (versioned on the API), or null when the API is unreachable. */
export async function getQuestionnaire(locale: Locale): Promise<Questionnaire | null> {
  if (!routing.locales.includes(locale)) return null;
  try {
    return await fetchQuestionnaire(locale);
  } catch {
    return null;
  }
}
