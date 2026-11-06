import type * as React from "react";

import { fieldControlClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Textarea({ className, rows = 5, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(fieldControlClasses, "min-h-28 resize-y py-3", className)}
      {...props}
    />
  );
}
