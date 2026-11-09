"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { completeLesson } from "@/app/[locale]/account/academy/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

type Props = {
  lessonId: string;
  course: string;
  done: boolean;
  /** Where to go once the lesson is done: the next lesson, the module quiz, or the outline. */
  next: { lesson: string } | { quiz: string } | null;
};

/** Marks the lesson as done (TASK-107), then moves on; a completed course shows its certificate. */
export function MarkLessonDone({ lessonId, course, done, next }: Props) {
  const t = useTranslations("Academy");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (done) {
    return (
      <p className="inline-flex items-center gap-2 font-medium">
        <CheckCircle2 aria-hidden="true" className="size-5 text-primary" />
        {t("lesson.done")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await completeLesson(lessonId);
            if (!result.ok) {
              setError(t(`errors.${result.error}`));
              return;
            }
            if (result.data.certificateCode || !next) {
              router.push({ pathname: "/account/academy/[course]", params: { course } });
            } else if ("lesson" in next) {
              router.push({ pathname: "/account/academy/[course]/lessons/[lesson]", params: { course, lesson: next.lesson } });
            } else {
              router.push({ pathname: "/account/academy/[course]/quiz/[module]", params: { course, module: next.quiz } });
            }
          })
        }
      >
        {t("lesson.markDone")}
      </Button>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
