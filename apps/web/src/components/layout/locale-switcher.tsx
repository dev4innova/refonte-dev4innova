"use client";

import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import type * as React from "react";

import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export type LocaleSwitcherProps = {
  /** aria-label of the landmark, e.g. "Langue" / "Language". */
  label: string;
  /** Each locale with its name written in that language ("Français", "English"). */
  options: { locale: Locale; name: string }[];
  className?: string;
};

/**
 * Links to the current page in each locale. Keeps the page (and its dynamic params);
 * next-intl stores the choice in the NEXT_LOCALE cookie for the next visit to `/`.
 */
export function LocaleSwitcher({ label, options, className }: LocaleSwitcherProps) {
  const current = useLocale();
  const pathname = usePathname();
  const params = useParams();
  // The pathname comes from the router, so it always matches one of the declared routes.
  const href = { pathname, params } as unknown as React.ComponentProps<typeof Link>["href"];

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex items-center rounded-lg border border-border bg-card p-0.5">
        {options.map(({ locale, name }) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <Link
                href={href}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex h-9 min-w-11 items-center justify-center rounded-md px-2 text-sm font-semibold",
                  "transition-colors duration-fast ease-standard",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span aria-hidden="true">{locale.toUpperCase()}</span>
                <span className="sr-only">{name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
