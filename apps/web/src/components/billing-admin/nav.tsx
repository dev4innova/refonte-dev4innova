"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "overview", href: "/admin/billing" },
  { key: "quotes", href: "/admin/billing/quotes" },
  { key: "invoices", href: "/admin/billing/invoices" },
  { key: "products", href: "/admin/billing/products" },
  { key: "payments", href: "/admin/billing/payments" },
] as const;

/** Sections of billing in the back office. */
export function BillingAdminNav() {
  return <BillingAdminNavView pathname={usePathname()} />;
}

export function BillingAdminNavView({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Admin.billing.nav");
  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const active = pathname !== null && (item.href === "/admin/billing" ? pathname === item.href : pathname.startsWith(item.href));
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
