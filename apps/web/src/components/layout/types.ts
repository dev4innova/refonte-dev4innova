/** A navigation link. `label` is already translated by the caller (next-intl in EPIC 03). */
export type NavItem = {
  href: string;
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
