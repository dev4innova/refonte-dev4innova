"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TYPES = ["article", "project", "service", "page"] as const;

export type AdminNavProps = {
  /** Show the CRM tab (sales staff and staff admins). */
  crm?: boolean;
  /** New prospects and quote requests, shown on the CRM tab. */
  crmBadge?: number;
  /** Show the AI tab (staff admins). */
  ai?: boolean;
};

/** Back-office tabs; the current section is marked with aria-current. */
export function AdminNav(props: AdminNavProps) {
  return <AdminNavView {...props} pathname={usePathname()} />;
}

/** Tabs without hooks on the URL: <Suspense> fallback with `pathname: null`. */
export function AdminNavView({
  pathname: currentPathname,
  crm = false,
  crmBadge = 0,
  ai = false,
}: AdminNavProps & { pathname: string | null }) {
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
    ...(crm
      ? [{ key: "crm", label: t("nav.crm"), href: "/admin/crm" as const, active: pathname.startsWith("/admin/crm") }]
      : []),
    ...(ai
      ? [{ key: "ai", label: t("nav.ai"), href: "/admin/ai" as const, active: pathname.startsWith("/admin/ai") }]
      : []),
  ];

  return (
    <nav aria-label={t("nav.label")} className="relative -mx-gutter overflow-x-auto px-gutter">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground",
                "transition-colors duration-fast hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "aria-[current=page]:border-primary aria-[current=page]:text-foreground",
              )}
            >
              {item.label}
              {item.key === "crm" && crmBadge > 0 ? (
                <>
                  <span aria-hidden="true" className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {crmBadge}
                  </span>
                  <span className="sr-only">({t("nav.crmBadge", { count: crmBadge })})</span>
                </>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
