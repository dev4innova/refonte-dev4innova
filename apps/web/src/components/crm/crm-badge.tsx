import { statusTone } from "@/lib/crm";
import { cn } from "@/lib/utils";

const TONES = {
  accent: { badge: "bg-accent text-accent-foreground", dot: "bg-primary" },
  success: { badge: "bg-secondary text-secondary-foreground", dot: "bg-primary-on-inverse" },
  neutral: { badge: "bg-muted text-foreground", dot: "bg-foreground" },
  muted: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
} as const;

/** Status of a prospect, stage of an opportunity or status of a quote request. */
export function CrmBadge({ value, label }: { value: string; label: string }) {
  const tone = TONES[statusTone(value)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", tone.badge)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {label}
    </span>
  );
}
