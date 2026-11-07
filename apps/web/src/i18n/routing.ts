import { defineRouting } from "next-intl/routing";

/**
 * Locales, URL prefix and localized pathnames (ADR-0008).
 * Keys are internal, locale-independent paths used in code (`<Link href="/about">`);
 * values are the public URL for each locale.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/solutions": "/solutions",
    "/solutions/[slug]": "/solutions/[slug]",
    "/services": "/services",
    "/services/[slug]": "/services/[slug]",
    "/portfolio": "/portfolio",
    "/innovation-lab": "/innovation-lab",
    "/academy": "/academy",
    "/insights": "/insights",
    "/contact": "/contact",
    "/about": { fr: "/a-propos", en: "/about" },
    "/legal-notice": { fr: "/mentions-legales", en: "/legal-notice" },
    "/privacy": { fr: "/confidentialite", en: "/privacy" },
    "/design-system": "/design-system",
    "/account": { fr: "/espace-client", en: "/account" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
/** Pathnames without dynamic segments: usable as plain `href` strings. */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}]${string}`>;
