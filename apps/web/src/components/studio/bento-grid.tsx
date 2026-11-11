import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Accessible Bento grid: a list whose DOM order is the reading order (no CSS `order`,
 * no dense packing). 1 column on mobile, 6 from 768 px, 12 from 1024 px.
 */
export function BentoGrid({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="bento-grid"
      className={cn("grid list-none gap-bento p-0 md:grid-cols-6 lg:grid-cols-12", className)}
      {...props}
    />
  );
}

const bentoCellVariants = cva(
  [
    "group/cell relative flex flex-col gap-4 rounded-frame border p-6",
    "transition-[border-color,transform] duration-base ease-out-soft",
    // Red filament drawn along the top edge on hover and keyboard focus.
    "before:absolute before:inset-x-6 before:-top-px before:h-0.5 before:origin-left before:scale-x-0",
    "before:bg-primary before:transition-transform before:duration-base before:ease-out-soft",
    "hover:before:scale-x-100 focus-within:before:scale-x-100",
  ],
  {
    variants: {
      size: {
        sm: "md:col-span-3 lg:col-span-4",
        md: "md:col-span-3 lg:col-span-5",
        lg: "md:col-span-3 lg:col-span-7",
        wide: "md:col-span-6 lg:col-span-12",
      },
      surface: {
        card: "border-border bg-card text-card-foreground hover:border-foreground/35 focus-within:border-foreground/35",
        tint: "border-transparent bg-tint-subtle text-tint-foreground hover:border-foreground/35 focus-within:border-foreground/35",
        inverse:
          "border-inverse-border bg-inverse-elevated text-inverse-foreground before:bg-primary-on-inverse hover:border-primary-on-inverse focus-within:border-primary-on-inverse",
      },
    },
    defaultVariants: { size: "md", surface: "card" },
  },
);

export type BentoCellProps = React.ComponentProps<"li"> & VariantProps<typeof bentoCellVariants>;

/**
 * A cell of the grid. When it holds a link marked `data-stretched` (in its title), the whole
 * cell is clickable while the link remains the only focusable element.
 */
export function BentoCell({ className, size, surface, ...props }: BentoCellProps) {
  return (
    <li
      data-slot="bento-cell"
      data-size={size ?? "md"}
      data-variant={surface === "inverse" ? "inverse" : undefined}
      className={cn(
        bentoCellVariants({ size, surface }),
        "[&_[data-stretched]]:after:absolute [&_[data-stretched]]:after:inset-0 [&_[data-stretched]]:after:rounded-frame [&_[data-stretched]]:after:content-['']",
        "[&_[data-stretched]]:focus-visible:outline-none [&:has([data-stretched]:focus-visible)]:outline-2 [&:has([data-stretched]:focus-visible)]:outline-offset-2 [&:has([data-stretched]:focus-visible)]:outline-ring",
        "data-[variant=inverse]:[&:has([data-stretched]:focus-visible)]:outline-primary-on-inverse",
        className,
      )}
      {...props}
    />
  );
}
