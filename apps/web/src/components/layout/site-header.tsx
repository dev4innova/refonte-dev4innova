import { UserRound } from "lucide-react";
import type * as React from "react";

import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import type { NavItem, NavLabels } from "@/components/layout/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export type SiteHeaderProps = {
  items: NavItem[];
  labels: NavLabels;
  /** Main call to action (e.g. Contact). */
  cta?: NavItem;
  /** Slot for the language switcher (TASK-036). */
  localeSwitcher?: React.ReactNode;
  /** Link to the client area (TASK-044), shown as an icon button. */
  account?: NavItem;
};

/** Sticky site header: logo, main navigation, call to action, burger menu below lg. */
export function SiteHeader({ items, labels, cta, localeSwitcher, account }: SiteHeaderProps) {
  return (
    <header
      data-slot="site-header"
      className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
    >
      <Container className="flex h-header items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={labels.home}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Logo />
        </Link>

        <nav aria-label={labels.navigation} className="hidden lg:block">
          <NavLinks items={items} />
        </nav>

        <div className="flex items-center gap-2">
          {localeSwitcher}
          {account ? (
            <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
              <Link href={account.href} aria-label={account.label} title={account.label}>
                <UserRound aria-hidden="true" className="size-5" />
              </Link>
            </Button>
          ) : null}
          {cta ? (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          ) : null}
          <MobileNav items={items} labels={labels} cta={cta} account={account} />
        </div>
      </Container>
    </header>
  );
}
