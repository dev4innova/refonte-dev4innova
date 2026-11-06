import type * as React from "react";

import { cn } from "@/lib/utils";

/** Centers content at the site max width with fluid side gutters. */
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="container"
      className={cn("mx-auto w-full max-w-site px-gutter", className)}
      {...props}
    />
  );
}
