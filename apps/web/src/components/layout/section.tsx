import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const sectionVariants = cva("py-section", {
  variants: {
    variant: {
      default: "bg-background text-foreground",
      card: "bg-card text-card-foreground",
      muted: "bg-muted text-foreground",
      tint: "bg-tint text-tint-foreground",
      inverse: "bg-inverse text-inverse-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export type SectionProps = React.ComponentProps<"section"> &
  VariantProps<typeof sectionVariants> & {
    /** Wrap children in a Container (default true). */
    contained?: boolean;
  };

/** Vertical page band with the fluid section spacing and a surface variant. */
export function Section({
  className,
  variant,
  contained = true,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      data-slot="section"
      data-variant={variant ?? "default"}
      className={cn(sectionVariants({ variant }), className)}
      {...props}
    >
      {contained ? <Container>{children}</Container> : children}
    </section>
  );
}
