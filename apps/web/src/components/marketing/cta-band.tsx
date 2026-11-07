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

/** Closing call to action of a page. */
export function CtaBand({ title, text, actionLabel, href = "/contact", secondary }: CtaBandProps) {
  return (
    <Section variant="inverse">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-display-md font-semibold">{title}</h2>
          {text ? <p className="text-lg text-inverse-muted-foreground">{text}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={href}>
              {actionLabel}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          {secondary ? (
            <Button asChild size="lg" variant="inverse">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
