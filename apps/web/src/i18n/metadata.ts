import type { Metadata } from "next";

import { getPathname } from "./navigation";
import { routing, type Locale } from "./routing";

type Href = Parameters<typeof getPathname>[0]["href"];

/**
 * Canonical URL and hreflang alternates of a page, for `generateMetadata`.
 * Relative URLs are resolved against `metadataBase` (SITE_URL) set in the locale layout.
 */
export function localeAlternates(locale: Locale, href: Href): Metadata["alternates"] {
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, getPathname({ locale: l, href })]),
  );
  return {
    canonical: getPathname({ locale, href }),
    languages: { ...languages, "x-default": getPathname({ locale: routing.defaultLocale, href }) },
  };
}

/**
 * The generated Open Graph image of the locale (src/app/[locale]/opengraph-image.tsx).
 * Declared explicitly: a page that sets its own `openGraph` would otherwise lose it.
 */
export function defaultOgImage(locale: Locale) {
  return { url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: "DEV4INNOVA" };
}

/** Title, description, canonical, hreflang and Open Graph of a public page (TASK-056). */
export function pageMetadata({
  locale,
  href,
  title,
  description,
}: {
  locale: Locale;
  href: Href;
  title?: string;
  description: string;
}): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: localeAlternates(locale, href),
    openGraph: {
      type: "website",
      url: getPathname({ locale, href }),
      description,
      ...(title ? { title } : {}),
      images: [defaultOgImage(locale)],
    },
  };
}
