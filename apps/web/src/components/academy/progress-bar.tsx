import { getTranslations } from "next-intl/server";

import type { MyCourse } from "@/lib/academy";

/** Progress of a learner in a course (lessons done and quizzes passed). */
export async function CourseProgressBar({ progress }: { progress: MyCourse["progress"] }) {
  const t = await getTranslations("Academy.learner");
  const label = t("progress", { percent: progress.percent });
  return (
    <div className="flex flex-col gap-1.5">
      <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="block h-2 rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
      </span>
      <span className="text-xs text-muted-foreground">
        {label} · {t("progressDetail", {
          lessonsDone: progress.lessons_done,
          lessonsTotal: progress.lessons_total,
          quizzesPassed: progress.quizzes_passed,
          quizzesTotal: progress.quizzes_total,
        })}
      </span>
    </div>
  );
}
