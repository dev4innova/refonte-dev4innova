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
    "/portfolio/[slug]": "/portfolio/[slug]",
    "/innovation-lab": "/innovation-lab",
    "/academy": "/academy",
    "/insights": "/insights",
    "/insights/[slug]": "/insights/[slug]",
    "/contact": "/contact",
    "/quote": { fr: "/devis", en: "/quote" },
    "/about": { fr: "/a-propos", en: "/about" },
    "/legal-notice": { fr: "/mentions-legales", en: "/legal-notice" },
    "/privacy": { fr: "/confidentialite", en: "/privacy" },
    "/design-system": "/design-system",
    "/account": { fr: "/espace-client", en: "/account" },
    "/account/ai/[org]": { fr: "/espace-client/ia/[org]", en: "/account/ai/[org]" },
    "/account/ai/[org]/[session]": {
      fr: "/espace-client/ia/[org]/[session]",
      en: "/account/ai/[org]/[session]",
    },
    "/admin": "/admin",
    "/admin/media": "/admin/media",
    "/admin/content/[type]": "/admin/content/[type]",
    "/admin/content/[type]/new": "/admin/content/[type]/new",
    "/admin/content/[type]/[id]": "/admin/content/[type]/[id]",
    "/admin/crm": "/admin/crm",
    "/admin/crm/leads": "/admin/crm/leads",
    "/admin/crm/leads/[id]": "/admin/crm/leads/[id]",
    "/admin/crm/pipeline": "/admin/crm/pipeline",
    "/admin/crm/quotes": "/admin/crm/quotes",
    "/admin/ai": "/admin/ai",
    "/admin/ai/models": "/admin/ai/models",
    "/admin/ai/prompts": "/admin/ai/prompts",
    "/admin/ai/prompts/[key]": "/admin/ai/prompts/[key]",
    "/admin/ai/playground": "/admin/ai/playground",
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
/** Pathnames without dynamic segments: usable as plain `href` strings. */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}]${string}`>;
