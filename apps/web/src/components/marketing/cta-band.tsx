import { ArrowRight } from "lucide-react";
import type * as React from "react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type Href = React.ComponentProps<typeof Link>["href"];

export type CtaBandProps = {
  title: string;
  text?: string;
  actionLabel: string;
  /** Defaults to the contact page. */
  href?: Href;
  /** Optional second, less prominent action (e.g. a quote request). */
  secondary?: { label: string; href: Href };
};

/**
 * Closing call to action of a page, on graphite with the signature filament. The footer does
 * not repeat its contact routes on a page that has one (data-contact-panel).
 */
export function CtaBand({ title, text, actionLabel, href = "/contact", secondary }: CtaBandProps) {
  return (
    <Section variant="inverse" data-contact-panel="" className="relative overflow-hidden">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        fill="none"
        className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full"
      >
        <path d="M0 20h520l20-14h300l20 14h340" stroke="var(--illu-signal)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-display-md font-semibold">{title}</h2>
          {text ? <p className="text-body-lg text-inverse-muted-foreground">{text}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={href}>
              {actionLabel}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          {secondary ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-inverse-muted-foreground text-inverse-foreground hover:border-inverse-foreground hover:text-inverse-foreground"
            >
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
