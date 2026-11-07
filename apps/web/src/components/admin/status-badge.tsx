import { cn } from "@/lib/utils";

export function StatusBadge({ status, label }: { status: "draft" | "published"; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "published" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", status === "published" ? "bg-primary" : "bg-muted-foreground")}
      />
      {label}
    </span>
  );
}
