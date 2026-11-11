import type * as React from "react";

import { Section } from "@/components/layout/section";
import { Eyebrow } from "@/components/studio/eyebrow";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  lead?: string;
  /** Rendered above the eyebrow (breadcrumb). */
  before?: React.ReactNode;
  /** Actions or extra content below the lead. */
  children?: React.ReactNode;
  /** Decorative illustration shown on the right from 1024 px (aria-hidden SVG). */
  illustration?: React.ReactNode;
  className?: string;
};

/**
 * Graphite page header with the single <h1> of the page (Creative Tech Studio): technical
 * grid, eyebrow, display title and lead, optional illustration. The site header turns
 * graphite over it (data-header-overlay).
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  before,
  children,
  illustration,
  className,
}: PageHeaderProps) {
  return (
    <Section
      variant="inverse"
      data-header-overlay=""
      className={cn("pattern-blueprint relative overflow-hidden", className)}
    >
      <div
        className={cn(
          "grid items-center gap-10",
          illustration ? "lg:grid-cols-[7fr_5fr] lg:gap-12" : undefined,
        )}
      >
        <div className="flex max-w-3xl animate-slide-up flex-col gap-6">
          {before}
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="text-display-lg font-bold sm:text-display-xl">{title}</h1>
          {lead ? <p className="max-w-2xl text-body-lg text-inverse-muted-foreground">{lead}</p> : null}
          {children}
        </div>
        {illustration ? (
          <div data-slot="page-header-illustration" className="hidden w-full max-w-md justify-self-end lg:block">
            {illustration}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
