import type * as React from "react";

import { fieldControlClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Native <select> with the look of the other form controls: accessible everywhere,
 * works without JavaScript and with FormField (id, aria-* are set by FormField). */
export function NativeSelect({ className, size = "md", ...props }: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "md" }) {
  return (
    <select
      data-slot="native-select"
      className={cn(fieldControlClasses, size === "sm" ? "h-9 px-2.5 text-sm" : "h-11 py-2", className)}
      {...props}
    />
  );
}
