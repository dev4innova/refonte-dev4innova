import type * as React from "react";

import { cn } from "@/lib/utils";

/** Shared look of text controls (Input, Textarea). */
export const fieldControlClasses = [
  "w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-base text-foreground shadow-card",
  "placeholder:text-muted-foreground",
  "transition-[border-color,box-shadow] duration-fast ease-standard",
  "hover:border-foreground/60",
  "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive/40",
];

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(fieldControlClasses, "h-11 py-2", className)}
      {...props}
    />
  );
}
