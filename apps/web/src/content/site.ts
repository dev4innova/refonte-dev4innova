/*
 * TEMPORARY French copy, until next-intl lands in EPIC 03 (TASK-032 to TASK-036).
 * Every visible string of the layout lives here, never inside components, so that the
 * migration to messages/{fr,en}.json is a mechanical move of this object.
 */
import type { FooterColumn } from "@/components/layout/site-footer";
import type { NavItem, NavLabels } from "@/components/layout/types";

export const siteContent = {
  brand: {
    name: "DEV4INNOVA",
    tagline: "L'intégrateur de solutions IA",
    description:
      "Nous concevons, intégrons et faisons vivre des solutions d'intelligence artificielle au service de votre activité.",
  },
  skipToContent: "Aller au contenu principal",
  nav: {
    items: [
      { href: "/solutions", label: "Solutions" },
      { href: "/services", label: "Services" },
      { href: "/portfolio", label: "Portfolio" },
      { href: "/innovation-lab", label: "Innovation Lab" },
      { href: "/academy", label: "Academy" },
      { href: "/insights", label: "Insights" },
    ] satisfies NavItem[],
    cta: { href: "/contact", label: "Nous contacter" } satisfies NavItem,
    labels: {
      navigation: "Navigation principale",
      openMenu: "Ouvrir le menu",
      closeMenu: "Fermer le menu",
      menuTitle: "Menu",
      home: "DEV4INNOVA, accueil",
    } satisfies NavLabels,
  },
  footer: {
    navigationLabel: "Plan du site",
    columns: [
      {
        title: "Offre",
        links: [
          { href: "/solutions", label: "Solutions" },
          { href: "/services", label: "Services" },
          { href: "/portfolio", label: "Portfolio" },
        ],
      },
      {
        title: "Innovation",
        links: [
          { href: "/innovation-lab", label: "Innovation Lab" },
          { href: "/academy", label: "Academy" },
          { href: "/insights", label: "Insights" },
        ],
      },
      {
        title: "Entreprise",
        links: [
          { href: "/a-propos", label: "À propos" },
          { href: "/contact", label: "Contact" },
        ],
      },
    ] satisfies FooterColumn[],
    legalLinks: [
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/confidentialite", label: "Confidentialité" },
    ] satisfies NavItem[],
    copyright: "© DEV4INNOVA. Tous droits réservés.",
  },
  home: {
    eyebrow: "DEV4INNOVA",
    title: "L'intégrateur de solutions IA",
    lead: "Stratégie, intégration et accompagnement : nous transformons l'intelligence artificielle en résultats concrets pour votre organisation.",
    primaryCta: "Nous contacter",
    secondaryCta: "Découvrir nos solutions",
  },
} as const;
