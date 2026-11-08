import { statusTone } from "@/lib/portal";
import { cn } from "@/lib/utils";

const TONES = {
  accent: { chip: "bg-accent text-accent-foreground", dot: "bg-primary" },
  success: { chip: "bg-secondary text-secondary-foreground", dot: "bg-primary-on-inverse" },
  neutral: { chip: "bg-muted text-foreground", dot: "bg-foreground" },
  muted: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
} as const;

/** Status of a project, task, deliverable or ticket (the label carries the meaning). */
export function StatusChip({ value, label }: { value: string; label: string }) {
  const tone = TONES[statusTone(value)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", tone.chip)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {label}
    </span>
  );
}
