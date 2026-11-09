import { cn } from "@/lib/utils";

/** Status of a course: published stands out, draft is calm. */
export function CourseStatus({ published, label }: { published: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", published ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", published ? "bg-primary-on-inverse" : "bg-muted-foreground")} />
      {label}
    </span>
  );
}
