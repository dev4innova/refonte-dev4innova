import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-base ease-standard",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-card hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        outline:
          "border border-foreground/80 bg-transparent text-foreground hover:border-primary hover:text-primary-ink",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        link: "text-primary-ink underline-offset-4 hover:underline",
        inverse: "bg-inverse-foreground text-inverse hover:bg-card",
        // Editorial link with an arrow that shifts on hover and focus (pass the arrow as a child).
        "signal-link": [
          "min-h-11 font-semibold text-primary-ink hover:text-primary-ink-hover",
          "in-data-[variant=inverse]:text-primary-on-inverse in-data-[variant=inverse]:hover:text-inverse-foreground",
          "[&_svg]:transition-transform [&_svg]:duration-base [&_svg]:ease-out-soft",
          "hover:[&_svg]:translate-x-1 focus-visible:[&_svg]:translate-x-1",
        ],
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "size-11",
      },
    },
    compoundVariants: [
      { variant: "link", className: "h-auto px-0" },
      { variant: "signal-link", className: "h-auto px-0 active:translate-y-0" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the child element (e.g. a link) with button styles instead of a <button>. */
    asChild?: boolean;
    /** Shows a spinner, sets aria-busy and blocks interaction. Ignored with asChild. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </button>
  );
}
