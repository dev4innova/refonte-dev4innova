import type * as React from "react";

import { Eyebrow } from "@/components/studio/eyebrow";
import { cn } from "@/lib/utils";

export type SectionHeadingProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Id of the heading, referenced by the section's aria-labelledby. */
  id: string;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  index?: string;
  lead?: React.ReactNode;
  /** Links or buttons shown under the lead. */
  actions?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
};

/**
 * Section opener: eyebrow, heading and lead in an asymmetric 5/12 composition from 1024 px,
 * stacked below. Text and actions arrive by props (next-intl).
 */
export function SectionHeading({
  id,
  title,
  eyebrow,
  index,
  lead,
  actions,
  as: Heading = "h2",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      data-slot="section-heading"
      className={cn(
        "mb-10 grid gap-5 sm:mb-14 lg:grid-cols-[5fr_7fr] lg:items-end lg:gap-12",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-4">
        {eyebrow ? <Eyebrow index={index}>{eyebrow}</Eyebrow> : null}
        <Heading id={id} className="text-display-md font-semibold sm:text-display-lg">
          {title}
        </Heading>
      </div>
      {lead || actions ? (
        <div className="flex max-w-xl flex-col items-start gap-5 lg:justify-self-end">
          {lead ? (
            <p className="text-body-lg text-muted-foreground in-data-[variant=inverse]:text-inverse-muted-foreground">
              {lead}
            </p>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
