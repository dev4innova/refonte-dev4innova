import { ChevronRight } from "lucide-react";
import type * as React from "react";

import { Link } from "@/i18n/navigation";

export type BreadcrumbItem = {
  label: string;
  href?: React.ComponentProps<typeof Link>["href"];
};

/** Breadcrumb on dark headers; the last item is the current page. */
export function Breadcrumb({ label, items }: { label: string; items: BreadcrumbItem[] }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-inverse-muted-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-sm hover:text-inverse-foreground focus-visible:outline-2 focus-visible:outline-primary-on-inverse"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="text-inverse-foreground">
                  {item.label}
                </span>
              )}
              {last ? null : <ChevronRight aria-hidden="true" className="size-4" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
