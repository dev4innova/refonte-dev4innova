
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import type { NavItem } from "@/components/layout/types";
import { Link } from "@/i18n/navigation";

export type FooterColumn = {
  title: string;
  links: NavItem[];
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
};

const linkClasses =
  "rounded-sm text-inverse-muted-foreground transition-colors duration-fast ease-standard hover:text-inverse-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-on-inverse";

/** Dark site footer: brand block, link columns and legal bar. */
export function SiteFooter({
  tagline,
  description,
  columns,
  legalLinks,
  copyright,
  navigationLabel,
}: SiteFooterProps) {
  return (
    <footer
      data-slot="site-footer"
      className="border-t border-inverse-border bg-inverse text-inverse-foreground"
    >
      <Container className="grid gap-12 py-16 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] md:py-20">
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
              <h2 className="font-heading text-sm font-semibold tracking-wide text-inverse-foreground uppercase">
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

      <div className="border-t border-inverse-border">
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
