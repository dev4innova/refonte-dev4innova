import type { MetadataRoute } from "next";

import { SERVICES, SOLUTIONS } from "@/config/offer";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

type Href = Parameters<typeof getPathname>[0]["href"];

/** Public, indexable pages. Private (/account), internal (/design-system) and legal
 * placeholders are excluded until their content is published. */
const PAGES: { href: Href; priority: number }[] = [
  { href: "/", priority: 1 },
  { href: "/solutions", priority: 0.9 },
  ...SOLUTIONS.map(({ slug }) => ({
    href: { pathname: "/solutions/[slug]" as const, params: { slug } },
    priority: 0.8,
  })),
  { href: "/services", priority: 0.9 },
  ...SERVICES.map(({ slug }) => ({
    href: { pathname: "/services/[slug]" as const, params: { slug } },
    priority: 0.8,
  })),
  { href: "/about", priority: 0.7 },
  { href: "/innovation-lab", priority: 0.7 },
  { href: "/academy", priority: 0.7 },
  { href: "/portfolio", priority: 0.6 },
  { href: "/insights", priority: 0.6 },
  { href: "/contact", priority: 0.8 },
];

/** /sitemap.xml with one entry per locale and hreflang alternates (TASK-056). */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  return PAGES.flatMap(({ href, priority }) => {
    const languages = Object.fromEntries(
      routing.locales.map((locale) => [locale, `${site}${getPathname({ locale, href })}`]),
    );
    return routing.locales.map((locale) => ({
      url: `${site}${getPathname({ locale, href })}`,
      priority,
      changeFrequency: "monthly" as const,
      alternates: { languages },
    }));
  });
}
