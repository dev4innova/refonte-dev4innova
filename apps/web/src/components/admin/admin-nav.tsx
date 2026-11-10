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
  /** Show the client portal tab (staff admins and sales). */
  portal?: boolean;
  /** Show the Academy tab (staff admins and editors). */
  academy?: boolean;
  /** Show the billing tab (staff admins and sales). */
  billing?: boolean;
  /** Show the accounts tab (staff admins): temporary passwords. */
  accounts?: boolean;
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
  portal = false,
  academy = false,
  billing = false,
  accounts = false,
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
    ...(academy
      ? [{ key: "academy", label: t("nav.academy"), href: "/admin/academy" as const, active: pathname.startsWith("/admin/academy") }]
      : []),
    ...(billing
      ? [{ key: "billing", label: t("nav.billing"), href: "/admin/billing" as const, active: pathname.startsWith("/admin/billing") }]
      : []),
    ...(portal
      ? [{ key: "portal", label: t("nav.portal"), href: "/admin/portal" as const, active: pathname.startsWith("/admin/portal") }]
      : []),
    ...(ai
      ? [{ key: "ai", label: t("nav.ai"), href: "/admin/ai" as const, active: pathname.startsWith("/admin/ai") }]
      : []),
    ...(accounts
      ? [{ key: "accounts", label: t("nav.accounts"), href: "/admin/accounts" as const, active: pathname.startsWith("/admin/accounts") }]
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
