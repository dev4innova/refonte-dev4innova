"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { NavLinks } from "@/components/layout/nav-links";
import type { NavItem, NavLabels } from "@/components/layout/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type MobileNavProps = {
  items: NavItem[];
  labels: NavLabels;
  cta?: NavItem;
};

/** Burger menu below 1024px (hidden from lg up). */
export function MobileNav({ items, labels, cta }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu aria-hidden="true" className="size-6" />
          <span className="sr-only">{labels.openMenu}</span>
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={labels.closeMenu} aria-describedby={undefined}>
        <SheetTitle className="pr-12">{labels.menuTitle}</SheetTitle>
        <nav aria-label={labels.navigation}>
          <NavLinks items={items} orientation="vertical" onNavigate={close} />
        </nav>
        {cta ? (
          <Button asChild size="lg" className="mt-auto w-full">
            <Link href={cta.href} onClick={close}>
              {cta.label}
            </Link>
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
