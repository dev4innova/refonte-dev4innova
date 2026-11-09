import { cn } from "@/lib/utils";

const TONES = {
  accent: { chip: "bg-accent text-accent-foreground", dot: "bg-primary" },
  success: { chip: "bg-secondary text-secondary-foreground", dot: "bg-primary-on-inverse" },
  neutral: { chip: "bg-muted text-foreground", dot: "bg-foreground" },
  muted: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
} as const;

const TONE: Record<string, keyof typeof TONES> = {
  sent: "accent",
  issued: "accent",
  past_due: "accent",
  overdue: "accent",
  accepted: "success",
  paid: "success",
  active: "success",
  declined: "muted",
  cancelled: "muted",
  expired: "muted",
  draft: "neutral",
  credit: "neutral",
};

/** Status of a quote, an invoice or a subscription (the label carries the meaning). */
export function BillingStatus({ value, label }: { value: string; label: string }) {
  const tone = TONES[TONE[value] ?? "neutral"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", tone.chip)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {label}
    </span>
  );
}
