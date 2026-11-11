import type * as React from "react";

import { cn } from "@/lib/utils";

export type EyebrowProps = React.ComponentProps<"p"> & {
  /** Section index shown before the label ("01"), in the secondary color. Decorative: it
   * is not part of the accessible name when the eyebrow is a heading. */
  index?: string;
  /** Rendered element: a paragraph by default, a heading when the eyebrow names the section. */
  as?: "p" | "span" | "h2" | "h3";
};

/** Indexed overline ("01 — Solutions"). Red ink on light surfaces, light red on graphite. */
export function Eyebrow({ index, as: Tag = "p", className, children, ...props }: EyebrowProps) {
  return (
    <Tag
      data-slot="eyebrow"
      className={cn(
        "inline-flex items-center gap-2.5 font-heading text-eyebrow font-medium uppercase",
        "text-primary-ink in-data-[variant=inverse]:text-primary-on-inverse",
        className,
      )}
      {...props}
    >
      {index ? (
        <span
          aria-hidden="true"
          data-slot="eyebrow-index"
          className="font-numeric text-muted-foreground in-data-[variant=inverse]:text-inverse-muted-foreground"
        >
          {index}
        </span>
      ) : null}
      {children}
    </Tag>
  );
}
