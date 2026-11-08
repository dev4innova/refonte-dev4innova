"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "overview", href: "/admin/portal" },
  { key: "support", href: "/admin/portal/support" },
] as const;

/** Sections of the client portal in the back office. */
export function PortalAdminNav() {
  return <PortalAdminNavView pathname={usePathname()} />;
}

export function PortalAdminNavView({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Admin.portal.nav");
  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const active =
            pathname !== null &&
            (item.href === "/admin/portal"
              ? pathname === item.href || pathname.startsWith("/admin/portal/projects")
              : pathname.startsWith(item.href));
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium",
                  "transition-colors duration-fast hover:bg-muted",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "aria-[current=page]:border-secondary aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
