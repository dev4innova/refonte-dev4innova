import type { Metadata } from "next";

import { getPathname } from "./navigation";
import { routing, type AppPathname, type Locale } from "./routing";

/**
 * Canonical URL and hreflang alternates of a page, for `generateMetadata`.
 * Relative URLs are resolved against `metadataBase` (SITE_URL) set in the locale layout.
 */
export function localeAlternates(locale: Locale, href: AppPathname): Metadata["alternates"] {
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, getPathname({ locale: l, href })]),
  );
  return {
    canonical: getPathname({ locale, href }),
    languages: { ...languages, "x-default": getPathname({ locale: routing.defaultLocale, href }) },
  };
}
