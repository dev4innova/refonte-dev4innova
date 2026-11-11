import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const tagVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral:
          "border-border bg-card text-foreground in-data-[variant=inverse]:border-inverse-border in-data-[variant=inverse]:bg-inverse-elevated in-data-[variant=inverse]:text-inverse-foreground",
        tint: "border-transparent bg-tint text-tint-foreground",
        signal: "border-transparent bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** Small label: technology, sector, status. Text only, never interactive. */
export function Tag({
  tone,
  className,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span data-slot="tag" className={cn(tagVariants({ tone }), className)} {...props} />;
}

const dotColors = {
  live: "bg-success",
  attention: "bg-warning",
  signal: "bg-primary in-data-[variant=inverse]:bg-primary-on-inverse",
  idle: "bg-input",
} as const;

/** Status dot. Decorative: the status is always written next to it. */
export function StatusDot({
  status = "live",
  className,
}: {
  status?: keyof typeof dotColors;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="status-dot"
      data-status={status}
      className={cn("inline-block size-2 shrink-0 rounded-full", dotColors[status], className)}
    />
  );
}

/** Keyboard key. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded-sm border border-b-2 border-input bg-card px-1.5 font-mono text-xs text-foreground",
        className,
      )}
      {...props}
    />
  );
}
