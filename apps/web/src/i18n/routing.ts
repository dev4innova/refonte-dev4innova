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
    "/diagnostic": { fr: "/diagnostic-ia", en: "/ai-diagnostic" },
    "/diagnostic/[token]": {
      fr: "/diagnostic-ia/resultat/[token]",
      en: "/ai-diagnostic/result/[token]",
    },
    "/about": { fr: "/a-propos", en: "/about" },
    "/legal-notice": { fr: "/mentions-legales", en: "/legal-notice" },
    "/privacy": { fr: "/confidentialite", en: "/privacy" },
    "/design-system": "/design-system",
    "/account": { fr: "/espace-client", en: "/account" },
    "/account/ai/[org]": { fr: "/espace-client/ia/[org]", en: "/account/ai/[org]" },
    "/account/notifications": { fr: "/espace-client/notifications", en: "/account/notifications" },
    "/account/portal/[org]": { fr: "/espace-client/portail/[org]", en: "/account/portal/[org]" },
    "/account/portal/[org]/projects/[project]": {
      fr: "/espace-client/portail/[org]/projets/[project]",
      en: "/account/portal/[org]/projects/[project]",
    },
    "/account/portal/[org]/documents": {
      fr: "/espace-client/portail/[org]/documents",
      en: "/account/portal/[org]/documents",
    },
    "/account/portal/[org]/support": {
      fr: "/espace-client/portail/[org]/support",
      en: "/account/portal/[org]/support",
    },
    "/account/portal/[org]/support/[ticket]": {
      fr: "/espace-client/portail/[org]/support/[ticket]",
      en: "/account/portal/[org]/support/[ticket]",
    },
    "/account/ai/[org]/[session]": {
      fr: "/espace-client/ia/[org]/[session]",
      en: "/account/ai/[org]/[session]",
    },
    "/admin": "/admin",
    "/admin/media": "/admin/media",
    "/admin/content/[type]": "/admin/content/[type]",
    "/admin/content/[type]/new": "/admin/content/[type]/new",
    "/admin/content/[type]/[id]": "/admin/content/[type]/[id]",
    "/admin/portal": "/admin/portal",
    "/admin/portal/projects/[id]": "/admin/portal/projects/[id]",
    "/admin/portal/support": "/admin/portal/support",
    "/admin/portal/support/[id]": "/admin/portal/support/[id]",
    "/admin/crm": "/admin/crm",
    "/admin/crm/leads": "/admin/crm/leads",
    "/admin/crm/leads/[id]": "/admin/crm/leads/[id]",
    "/admin/crm/pipeline": "/admin/crm/pipeline",
    "/admin/crm/quotes": "/admin/crm/quotes",
    "/admin/crm/diagnostics": "/admin/crm/diagnostics",
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
