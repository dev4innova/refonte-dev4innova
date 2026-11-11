import Image from "next/image";
import type * as React from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export type ContentCard = {
  key: string;
  title: string;
  summary: string;
  href: React.ComponentProps<typeof Link>["href"];
  /** Already formatted (e.g. publication date, industry). */
  meta?: string;
  cover?: { url: string; alt: string; width: number; height: number } | null;
};

/** Grid of articles or projects; the whole card is clickable. */
export function ContentGrid({ items }: { items: ContentCard[] }) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.key} className="flex">
          <Card variant="frame" className="w-full gap-0 overflow-hidden p-0 sm:p-0">
            {item.cover ? (
              <Image
                src={item.cover.url}
                alt={item.cover.alt}
                width={item.cover.width}
                height={item.cover.height}
                // Media are served by the object storage CDN, already optimized at upload.
                unoptimized
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <div aria-hidden="true" className="pattern-blueprint aspect-[16/9] w-full bg-inverse" />
            )}
            <CardHeader className="p-6">
              {item.meta ? <p className="text-sm text-muted-foreground">{item.meta}</p> : null}
              <CardTitle>
                <Link
                  href={item.href}
                  className="after:absolute after:inset-0 after:rounded-frame focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
                >
                  {item.title}
                </Link>
              </CardTitle>
              <CardDescription>{item.summary}</CardDescription>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Placeholder while CMS content streams in. */
export function ContentGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="h-72 animate-pulse rounded-frame bg-muted" />
      ))}
    </ul>
  );
}
