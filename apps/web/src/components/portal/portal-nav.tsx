"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Sections of an organization's portal; the current one is marked with aria-current. */
export function PortalNav({ org, academy = false, academyLabel = "" }: { org: string; academy?: boolean; academyLabel?: string }) {
  const t = useTranslations("Portal.nav");
  // next-intl gives the internal pathname: the template ("[org]") or the value, depending on the route.
  const pathname = usePathname().replace(org, "[org]");
  const base = "/account/portal/[org]";
  const items = [
    { key: "dashboard", href: { pathname: "/account/portal/[org]" as const, params: { org } }, active: pathname === base || pathname.startsWith(`${base}/projects`) },
    { key: "documents", href: { pathname: "/account/portal/[org]/documents" as const, params: { org } }, active: pathname.startsWith(`${base}/documents`) },
    { key: "support", href: { pathname: "/account/portal/[org]/support" as const, params: { org } }, active: pathname.startsWith(`${base}/support`) },
    ...(academy
      ? [{ key: "academy", href: { pathname: "/account/portal/[org]/academy" as const, params: { org } }, active: pathname.startsWith(`${base}/academy`) }]
      : []),
  ];
  return (
    <nav aria-label={t("label")} className="relative -mx-gutter overflow-x-auto px-gutter">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground",
                "transition-colors duration-fast hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "aria-[current=page]:border-primary aria-[current=page]:text-foreground",
              )}
            >
              {item.key === "academy" ? academyLabel : t(item.key as "dashboard" | "documents" | "support")}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
