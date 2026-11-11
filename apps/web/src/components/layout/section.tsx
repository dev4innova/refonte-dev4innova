import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const sectionVariants = cva("", {
  variants: {
    variant: {
      default: "bg-background text-foreground",
      card: "bg-card text-card-foreground",
      muted: "bg-muted text-foreground",
      tint: "bg-tint text-tint-foreground",
      inverse: "bg-inverse text-inverse-foreground",
    },
    spacing: {
      default: "py-section",
      tight: "py-section-tight",
    },
  },
  defaultVariants: { variant: "default", spacing: "default" },
});

export type SectionProps = React.ComponentProps<"section"> &
  VariantProps<typeof sectionVariants> & {
    /** Wrap children in a Container (default true). */
    contained?: boolean;
    /** Hairline rule across the top of the section, inside the container. */
    rule?: boolean;
  };

/** Vertical page band with the fluid section spacing and a surface variant. */
export function Section({
  className,
  variant,
  spacing,
  contained = true,
  rule = false,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      data-slot="section"
      data-variant={variant ?? "default"}
      className={cn(sectionVariants({ variant, spacing }), rule && "relative", className)}
      {...props}
    >
      {rule ? (
        <div aria-hidden="true" data-slot="section-rule" className="absolute inset-x-0 top-0">
          <Container>
            <div className="border-t border-hairline" />
          </Container>
        </div>
      ) : null}
      {contained ? <Container>{children}</Container> : children}
    </section>
  );
}
