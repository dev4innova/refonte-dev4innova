import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import type { NavItem } from "@/components/layout/types";
import { Link } from "@/i18n/navigation";

export type FooterColumn = {
  title: string;
  links: NavItem[];
};

/** A way to get in touch, recalled at the top of the footer (contact, diagnostic). */
export type FooterRoute = NavItem & {
  text: string;
  /** Visible call to action (decorative: the title is the link). */
  action: string;
};

export type SiteFooterProps = {
  /** Positioning line, e.g. "L'intégrateur de solutions IA". */
  tagline: string;
  description?: string;
  columns: FooterColumn[];
  legalLinks: NavItem[];
  /** e.g. "© 2026 DEV4INNOVA. Tous droits réservés." */
  copyright: string;
  /** aria-label of the footer navigation landmark. */
  navigationLabel: string;
  /** Heading of the contact band ("Un projet, une question ?") and its routes. */
  routesTitle?: string;
  routes?: FooterRoute[];
};

const linkClasses =
  "rounded-sm text-inverse-muted-foreground transition-colors duration-fast ease-standard hover:text-inverse-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-on-inverse";

/**
 * Graphite site footer: contact band (contact and diagnostic), brand block, link columns,
 * large decorative wordmark and legal bar.
 */
export function SiteFooter({
  tagline,
  description,
  columns,
  legalLinks,
  copyright,
  navigationLabel,
  routesTitle,
  routes = [],
}: SiteFooterProps) {
  return (
    <footer
      data-slot="site-footer"
      data-variant="inverse"
      className="border-t border-inverse-border bg-inverse-deep text-inverse-foreground"
    >
      {routes.length > 0 ? (
        <Container className="pt-14 md:pt-20">
          <div className="grid gap-6 border-b border-inverse-border pb-12 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] md:pb-16">
            {routesTitle ? (
              <h2 className="font-heading text-display-md font-semibold text-balance">{routesTitle}</h2>
            ) : null}
            <ul className="grid list-none gap-bento p-0 sm:grid-cols-2">
              {routes.map((route) => (
                <li
                  key={route.href}
                  className="group/route relative flex flex-col gap-2 rounded-frame border border-inverse-border bg-inverse-elevated p-6 transition-colors duration-base ease-standard hover:border-primary-on-inverse has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary-on-inverse"
                >
                  <h3 className="font-heading text-heading-sm font-semibold">
                    <Link
                      href={route.href}
                      className="after:absolute after:inset-0 after:rounded-frame focus-visible:outline-none"
                    >
                      {route.label}
                    </Link>
                  </h3>
                  <p className="text-sm text-inverse-muted-foreground">{route.text}</p>
                  <span
                    aria-hidden="true"
                    className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary-on-inverse"
                  >
                    {route.action}
                    <ArrowRight className="size-4 transition-transform duration-base ease-out-soft group-hover/route:translate-x-1 group-has-[a:focus-visible]/route:translate-x-1" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      ) : null}

      <Container className="grid gap-12 py-14 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] md:py-16">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo variant="inverse" />
          <p className="font-heading text-heading-sm font-medium text-inverse-foreground">
            {tagline}
          </p>
          {description ? <p className="text-sm text-inverse-muted-foreground">{description}</p> : null}
        </div>

        <nav aria-label={navigationLabel} className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-4">
              <h2 className="font-heading text-eyebrow font-medium text-inverse-muted-foreground uppercase">
                {column.title}
              </h2>
              <ul className="flex flex-col gap-3 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClasses}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>

      <Container aria-hidden="true" className="overflow-hidden">
        <p
          data-slot="footer-wordmark"
          className="font-heading text-[clamp(3rem,1rem+10vw,9.5rem)] leading-[0.9] font-bold tracking-[-0.05em] text-inverse-muted-foreground select-none"
        >
          Dev<span className="text-primary-on-inverse">4</span>Innova
        </p>
      </Container>

      <div className="mt-8 border-t border-inverse-border">
        <Container className="flex flex-col gap-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-inverse-muted-foreground">{copyright}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClasses}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}
