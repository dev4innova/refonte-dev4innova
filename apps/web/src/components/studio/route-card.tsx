import { ArrowRight } from "lucide-react";
import type * as React from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type RouteCardProps = {
  href: React.ComponentProps<typeof Link>["href"];
  title: string;
  text: string;
  /** Visible call to action (decorative: the title is the only link). */
  action: string;
  headingLevel?: "h2" | "h3";
  className?: string;
};

/** A way to get in touch (contact, diagnostic) on graphite: the whole card is one link. */
export function RouteCard({
  href,
  title,
  text,
  action,
  headingLevel: Heading = "h3",
  className,
}: RouteCardProps) {
  return (
    <div
      data-slot="route-card"
      className={cn(
        "group/route relative flex flex-col gap-2 rounded-frame border border-inverse-border bg-inverse-elevated p-6 text-inverse-foreground",
        "transition-colors duration-base ease-standard hover:border-primary-on-inverse",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary-on-inverse",
        className,
      )}
    >
      <Heading className="font-heading text-heading-sm font-semibold">
        <Link
          href={href}
          className="after:absolute after:inset-0 after:rounded-frame focus-visible:outline-none"
        >
          {title}
        </Link>
      </Heading>
      <p className="text-sm text-inverse-muted-foreground">{text}</p>
      <span
        aria-hidden="true"
        className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary-on-inverse"
      >
        {action}
        <ArrowRight className="size-4 transition-transform duration-base ease-out-soft group-hover/route:translate-x-1 group-has-[a:focus-visible]/route:translate-x-1" />
      </span>
    </div>
  );
}
