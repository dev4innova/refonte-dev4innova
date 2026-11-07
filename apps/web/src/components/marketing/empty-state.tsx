import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: React.ReactNode;
};

/** Placeholder for a list that has no content yet (portfolio, articles...). */
export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-xl border border-dashed border-input bg-card px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <h2 className="text-heading-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
