import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { LEGAL_PAGES } from "@/components/cms/legal-page";
import { SOLUTIONS } from "@/config/offer";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { type ContentType, getContent, getContentList } from "@/lib/cms";
import { getSiteUrl } from "@/lib/site-url";

type Href = Parameters<typeof getPathname>[0]["href"];
type Entry = { href: (locale: Locale) => Href; priority: number; lastModified?: string };

/** Public, indexable pages. Private (/account, /admin) and internal (/design-system)
 * pages are excluded; CMS content is listed once published. */
const STATIC_PAGES: Entry[] = [
  ["/", 1],
  ["/solutions", 0.9],
  ["/services", 0.9],
  ["/about", 0.7],
  ["/innovation-lab", 0.7],
  ["/academy", 0.7],
  ["/portfolio", 0.6],
  ["/insights", 0.6],
  ["/contact", 0.8],
  ["/quote", 0.7],
  ["/diagnostic", 0.8],
].map(([href, priority]) => ({ href: () => href as Href, priority: priority as number }));

const SOLUTION_PAGES: Entry[] = SOLUTIONS.map(({ slug }) => ({
  href: () => ({ pathname: "/solutions/[slug]" as const, params: { slug } }),
  priority: 0.8,
}));

type CmsPathname = "/services/[slug]" | "/insights/[slug]" | "/portfolio/[slug]";

const CMS_ROUTES: { type: ContentType; pathname: CmsPathname; priority: number }[] = [
  { type: "service", pathname: "/services/[slug]", priority: 0.8 },
  { type: "article", pathname: "/insights/[slug]", priority: 0.7 },
  { type: "project", pathname: "/portfolio/[slug]", priority: 0.7 },
];

async function cmsEntries(): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (const { type, pathname, priority } of CMS_ROUTES) {
    // Slugs differ per language: read each list and pair documents by id.
    const lists = await Promise.all(routing.locales.map((l) => getContentList(type, l)));
    const byLocale = Object.fromEntries(
      routing.locales.map((l, i) => [l, new Map(lists[i]!.map((c) => [c.id, c]))]),
    ) as Record<Locale, Map<string, (typeof lists)[number][number]>>;
    for (const item of lists[0] ?? []) {
      entries.push({
        href: (l) => ({ pathname, params: { slug: byLocale[l].get(item.id)?.slug ?? item.slug } }),
        priority,
        lastModified: item.published_at ?? undefined,
      });
    }
  }
  for (const [pathname, { slugs }] of Object.entries(LEGAL_PAGES)) {
    if (await getContent("page", "fr", slugs.fr)) {
      entries.push({ href: () => pathname as Href, priority: 0.3 });
    }
  }
  return entries;
}

/** /sitemap.xml with one entry per locale and hreflang alternates (TASK-056). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // request time: never frozen at build when the API is unreachable
  const site = getSiteUrl();
  const entries = [...STATIC_PAGES, ...SOLUTION_PAGES, ...(await cmsEntries())];
  return entries.flatMap(({ href, priority, lastModified }) => {
    const languages = Object.fromEntries(
      routing.locales.map((locale) => [locale, `${site}${getPathname({ locale, href: href(locale) })}`]),
    );
    return routing.locales.map((locale) => ({
      url: languages[locale]!,
      priority,
      changeFrequency: "monthly" as const,
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages },
    }));
  });
}
