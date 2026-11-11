import type { StaticPathname } from "@/i18n/routing";
import type en from "../../messages/en.json";

type NavigationKey = keyof (typeof en)["Navigation"];
type FooterMessages = (typeof en)["Footer"];
/** Footer labels only (not the nested contact routes). */
type FooterKey = { [K in keyof FooterMessages]: FooterMessages[K] extends string ? K : never }[keyof FooterMessages];

/** Site structure: internal pathnames and the message key of each label. */
export const mainNavigation: { href: StaticPathname; labelKey: NavigationKey }[] = [
  { href: "/solutions", labelKey: "solutions" },
  { href: "/services", labelKey: "services" },
  { href: "/portfolio", labelKey: "portfolio" },
  { href: "/innovation-lab", labelKey: "innovationLab" },
  { href: "/academy", labelKey: "academy" },
  { href: "/insights", labelKey: "insights" },
];

export const ctaNavigation = { href: "/contact", labelKey: "cta" } as const satisfies {
  href: StaticPathname;
  labelKey: NavigationKey;
};

export const footerNavigation: {
  titleKey: FooterKey;
  links: { href: StaticPathname; labelKey: NavigationKey }[];
}[] = [
  {
    titleKey: "offer",
    links: [
      { href: "/solutions", labelKey: "solutions" },
      { href: "/services", labelKey: "services" },
      { href: "/portfolio", labelKey: "portfolio" },
      { href: "/diagnostic", labelKey: "diagnostic" },
    ],
  },
  {
    titleKey: "innovation",
    links: [
      { href: "/innovation-lab", labelKey: "innovationLab" },
      { href: "/academy", labelKey: "academy" },
      { href: "/insights", labelKey: "insights" },
    ],
  },
  {
    titleKey: "company",
    links: [
      { href: "/about", labelKey: "about" },
      { href: "/contact", labelKey: "contact" },
      { href: "/quote", labelKey: "quote" },
    ],
  },
];

export const legalNavigation: { href: StaticPathname; labelKey: FooterKey }[] = [
  { href: "/legal-notice", labelKey: "legalNotice" },
  { href: "/privacy", labelKey: "privacy" },
];
