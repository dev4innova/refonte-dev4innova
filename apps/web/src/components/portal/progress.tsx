import { getTranslations } from "next-intl/server";

import type { ProjectSummary } from "@/lib/portal";

/** Progress of a project: done tasks out of all tasks. */
export async function ProjectProgress({ progress }: { progress: ProjectSummary["progress"] }) {
  const t = await getTranslations("Portal.project");
  const label = progress.total ? t("progress", progress) : t("noTasks");
  return (
    <div className="flex flex-col gap-1.5">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="block h-2 rounded-full bg-muted"
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
