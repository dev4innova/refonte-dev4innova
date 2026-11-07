"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TYPES = ["article", "project", "service", "page"] as const;

/** Back-office tabs; the current section is marked with aria-current. */
export function AdminNav() {
  return <AdminNavView pathname={usePathname()} />;
}

/** Tabs without hooks on the URL: <Suspense> fallback with `pathname: null`. */
export function AdminNavView({ pathname: currentPathname }: { pathname: string | null }) {
  const t = useTranslations("Admin");
  const pathname = currentPathname ?? "";
  const items = [
    { key: "dashboard", label: t("nav.dashboard"), href: "/admin" as const, active: pathname === "/admin" },
    ...TYPES.map((type) => ({
      key: type,
      label: t(`types.${type}`),
      href: { pathname: "/admin/content/[type]" as const, params: { type } },
      active: pathname.startsWith("/admin/content") && pathname.includes(`/${type}`),
    })),
    { key: "media", label: t("nav.media"), href: "/admin/media" as const, active: pathname === "/admin/media" },
  ];

  return (
    <nav aria-label={t("nav.label")} className="-mx-gutter overflow-x-auto px-gutter">
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
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
