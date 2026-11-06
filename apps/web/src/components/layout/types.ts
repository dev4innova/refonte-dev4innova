import type { AppPathname } from "@/i18n/routing";

/** A navigation link: an internal pathname (localized by the Link) and a translated label. */
export type NavItem = {
  href: AppPathname;
  label: string;
};

export type NavLabels = {
  /** aria-label of the <nav> landmark, e.g. "Navigation principale". */
  navigation: string;
  /** Accessible name of the burger button. */
  openMenu: string;
  /** Accessible name of the close button inside the mobile menu. */
  closeMenu: string;
  /** Title of the mobile menu dialog. */
  menuTitle: string;
  /** Accessible name of the logo link to the homepage. */
  home: string;
};
