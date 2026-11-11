import { ArrowRight } from "lucide-react";
import { connection } from "next/server";
import type * as React from "react";

import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getContentList } from "@/lib/cms";

/**
 * Published services from the CMS as an editorial list (number, title, summary, arrow):
 * a list rather than cards, to vary the rhythm of the homepage. `empty` is shown when no
 * service is published in the locale.
 */
export async function ServicesList({ locale, empty }: { locale: Locale; empty: React.ReactNode }) {
  await connection();
  const services = await getContentList("service", locale);
  if (services.length === 0) return <>{empty}</>;

  return (
    <ol data-slot="services-list" className="list-none border-t border-border p-0">
      {services.map((service, index) => (
        <li key={service.id} className="border-b border-border">
          <Link
            href={{ pathname: "/services/[slug]", params: { slug: service.slug } }}
            className="group/service grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 gap-y-1 py-6 transition-colors duration-fast ease-standard hover:text-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:gap-x-8"
          >
            <span aria-hidden="true" className="font-heading font-numeric text-sm font-medium text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-heading text-heading-sm font-semibold sm:text-heading-lg">{service.title}</span>
            <span className="col-start-2 row-start-2 text-muted-foreground sm:col-start-3 sm:row-start-1">
              {service.summary}
            </span>
            <ArrowRight
              aria-hidden="true"
              className="col-start-3 row-start-1 size-5 self-center transition-transform duration-base ease-out-soft group-hover/service:translate-x-1 group-focus-visible/service:translate-x-1 sm:col-start-4"
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** Placeholder with the final size of a few rows (no layout shift when the list arrives). */
export function ServicesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ol aria-hidden="true" className="list-none border-t border-border p-0">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-center gap-8 border-b border-border py-6">
          <span className="h-4 w-8 rounded bg-muted" />
          <span className="h-6 w-1/3 rounded bg-muted" />
          <span className="hidden h-4 flex-1 rounded bg-muted sm:block" />
        </li>
      ))}
    </ol>
  );
}
