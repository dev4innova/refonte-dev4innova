import type { AppPathname } from "@/i18n/routing";
import type en from "../../messages/en.json";

type NavigationKey = keyof (typeof en)["Navigation"];
type FooterKey = keyof (typeof en)["Footer"];

/** Site structure: internal pathnames and the message key of each label. */
export const mainNavigation: { href: AppPathname; labelKey: NavigationKey }[] = [
  { href: "/solutions", labelKey: "solutions" },
  { href: "/services", labelKey: "services" },
  { href: "/portfolio", labelKey: "portfolio" },
  { href: "/innovation-lab", labelKey: "innovationLab" },
  { href: "/academy", labelKey: "academy" },
  { href: "/insights", labelKey: "insights" },
];

export const ctaNavigation = { href: "/contact", labelKey: "cta" } as const satisfies {
  href: AppPathname;
  labelKey: NavigationKey;
};

export const footerNavigation: {
  titleKey: FooterKey;
  links: { href: AppPathname; labelKey: NavigationKey }[];
}[] = [
  {
    titleKey: "offer",
    links: [
      { href: "/solutions", labelKey: "solutions" },
      { href: "/services", labelKey: "services" },
      { href: "/portfolio", labelKey: "portfolio" },
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
    ],
  },
];

export const legalNavigation: { href: AppPathname; labelKey: FooterKey }[] = [
  { href: "/legal-notice", labelKey: "legalNotice" },
  { href: "/privacy", labelKey: "privacy" },
];
