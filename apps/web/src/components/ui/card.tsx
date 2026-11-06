import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const cardVariants = cva("flex flex-col gap-6 rounded-xl border p-6 sm:p-8", {
  variants: {
    variant: {
      default: "border-border bg-card text-card-foreground",
      elevated: "border-transparent bg-card text-card-foreground shadow-elevated",
      inverse: "border-inverse-border bg-inverse text-inverse-foreground",
    },
    interactive: {
      true: [
        "transition-[transform,box-shadow,border-color] duration-base ease-out-soft",
        "hover:-translate-y-1 hover:border-primary/60 hover:shadow-elevated",
        "focus-within:border-primary/60",
      ],
      false: "",
    },
  },
  defaultVariants: { variant: "default", interactive: false },
});

export type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, interactive, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant ?? "default"}
      className={cn(cardVariants({ variant, interactive }), className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

type HeadingLevel = "h2" | "h3" | "h4";

export function CardTitle({
  as: Heading = "h3",
  className,
  ...props
}: React.ComponentProps<"h3"> & { as?: HeadingLevel }) {
  return (
    <Heading
      data-slot="card-title"
      className={cn("font-heading text-heading-lg font-semibold", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn(
        "text-muted-foreground in-data-[variant=inverse]:text-inverse-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex-1", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-footer" className={cn("flex items-center gap-3", className)} {...props} />
  );
}
