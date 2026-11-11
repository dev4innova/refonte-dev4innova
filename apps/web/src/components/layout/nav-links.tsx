"use client";

import type { NavItem } from "@/components/layout/types";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** True when `href` is the current page or one of its parents (except the homepage). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavLinksProps = {
  items: NavItem[];
  orientation?: "horizontal" | "vertical";
  /** Called after a link is chosen (closes the mobile menu). */
  onNavigate?: () => void;
  className?: string;
};

/** Navigation links with aria-current on the active page. Render inside <Suspense> with
 * <NavLinksList pathname={null}> as fallback: routes with request-time params read the
 * pathname at request time (Next.js Cache Components). */
export function NavLinks(props: NavLinksProps) {
  return <NavLinksList {...props} pathname={usePathname()} />;
}

/** The links themselves; `pathname: null` renders them without an active page. */
export function NavLinksList({
  items,
  orientation = "horizontal",
  onNavigate,
  className,
  pathname,
}: NavLinksProps & { pathname: string | null }) {
  return (
    <ul
      className={cn(
        orientation === "horizontal" ? "flex items-center gap-1" : "flex flex-col gap-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = pathname !== null && isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "relative inline-flex items-center rounded-md font-medium whitespace-nowrap text-foreground/80",
                "transition-colors duration-fast ease-standard hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "aria-[current=page]:text-foreground",
                orientation === "horizontal"
                  ? [
                      // Tighter between 1024 and 1279 px: the full navigation fits next to the actions.
                      "h-10 px-2 text-sm xl:px-3",
                      "after:absolute after:inset-x-2 xl:after:inset-x-3 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0",
                      "after:bg-primary after:transition-transform after:duration-base after:ease-out-soft",
                      "hover:after:scale-x-100 aria-[current=page]:after:scale-x-100",
                    ]
                  : "min-h-12 w-full px-3 text-lg hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
