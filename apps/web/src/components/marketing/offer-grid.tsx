import { ArrowRight, type LucideIcon } from "lucide-react";
import type * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export type OfferItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  href: React.ComponentProps<typeof Link>["href"];
};

/**
 * Grid of solution or service cards. The whole card is clickable (stretched link) while
 * the accessible name of the link stays the card title.
 */
export function OfferGrid({ items, linkLabel }: { items: OfferItem[]; linkLabel: string }) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map(({ key, icon: Icon, title, summary, href }) => (
        <li key={key} className="flex">
          <Card interactive className="relative w-full">
            <CardHeader>
              <span className="grid size-12 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <CardTitle>
                <Link
                  href={href}
                  className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
                >
                  {title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{summary}</CardDescription>
            </CardContent>
            <CardFooter>
              <span aria-hidden="true" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                {linkLabel}
                <ArrowRight className="size-4" />
              </span>
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}
