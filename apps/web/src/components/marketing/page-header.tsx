import type * as React from "react";

import { Section } from "@/components/layout/section";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  lead?: string;
  /** Rendered above the eyebrow (breadcrumb). */
  before?: React.ReactNode;
  /** Actions or extra content below the lead. */
  children?: React.ReactNode;
  className?: string;
};

/** Dark page header with the single <h1> of the page. */
export function PageHeader({ eyebrow, title, lead, before, children, className }: PageHeaderProps) {
  return (
    <Section variant="inverse" className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 right-[-15%] size-[32rem] rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative flex max-w-3xl animate-slide-up flex-col gap-6">
        {before}
        {eyebrow ? (
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary-on-inverse uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-display-lg font-bold">{title}</h1>
        {lead ? <p className="max-w-2xl text-lg text-inverse-muted-foreground">{lead}</p> : null}
        {children}
      </div>
    </Section>
  );
}
