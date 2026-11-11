import type { getTranslations } from "next-intl/server";

import { SOLUTIONS, type SolutionSlug } from "@/config/offer";

type SolutionsTranslator = Awaited<ReturnType<typeof getTranslations<"Solutions">>>;

/** Title and summary of each solution (namespace `Solutions`), for SolutionsBento. */
export function solutionItems(t: SolutionsTranslator) {
  return Object.fromEntries(
    SOLUTIONS.map(({ slug }) => [
      slug,
      { title: t(`items.${slug}.title`), summary: t(`items.${slug}.summary`) },
    ]),
  ) as Record<SolutionSlug, { title: string; summary: string }>;
}
