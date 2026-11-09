import { ArrowLeft, Award, CheckCircle2, Circle, ClipboardCheck, PlayCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CourseProgressBar } from "@/components/academy/progress-bar";
import { Prose } from "@/components/cms/prose";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learnerApi } from "@/lib/academy-learner";

type Props = { params: Promise<{ locale: Locale; course: string }>; searchParams: Promise<{ paid?: string }> };

/** A course followed by the learner: outline, progress, quizzes, certificate (TASK-107). */
export default function LearnerCoursePage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <LearnerCourse {...props} />
    </Suspense>
  );
}

async function LearnerCourse({ params, searchParams }: Props) {
  const [{ locale, course: slug }, query] = await Promise.all([params, searchParams]);
  const api = await learnerApi(locale, { pathname: "/account/academy/[course]", params: { course: slug } });
  const { data: course, response } = await api
    .GET("/api/v1/me/academy/courses/{slug}", { params: { path: { slug }, query: { locale } } })
    .catch(() => ({ data: undefined, response: undefined }));
  if ((response?.status === 404 || response?.status === 422) && query.paid) {
    // Bought a moment ago: the payment is confirmed by Stripe's webhook, which may lag.
    const tBilling = await getTranslations({ locale, namespace: "Billing.course" });
    return (
      <div className="flex max-w-2xl flex-col items-start gap-4">
        <p role="status" className="rounded-xl border border-primary/30 bg-accent/40 p-4">{tBilling("pending")}</p>
        <Button asChild variant="secondary">
          <Link href={{ pathname: "/account/academy/[course]", params: { course: slug }, query: { paid: "1" } }}>{tBilling("reload")}</Link>
        </Button>
      </div>
    );
  }
  if (response?.status === 404 || response?.status === 422) notFound();
  const t = await getTranslations({ locale, namespace: "Academy" });
  if (!course) return <p role="alert" className="text-destructive">{t("errors.generic")}</p>;
  const lessonHref = (lesson: string) => ({ pathname: "/account/academy/[course]/lessons/[lesson]" as const, params: { course: slug, lesson } });

  return (
    <>
      <Link href="/account/academy" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("learner.allCourses")}
      </Link>
      <div className="flex flex-col gap-3">
        <h1 className="text-display-md font-semibold">{course.course.title}</h1>
        {course.sponsor ? <p className="text-sm text-muted-foreground">{t("learner.sponsor", { name: course.sponsor.name })}</p> : null}
        <div className="max-w-xl">
          <CourseProgressBar progress={course.progress} />
        </div>
      </div>

      {course.certificate_code ? (
        <section aria-labelledby="course-done" className="flex flex-col items-start gap-3 rounded-xl border border-primary/30 bg-accent/40 p-6">
          <h2 id="course-done" className="inline-flex items-center gap-2 text-heading-sm font-semibold">
            <Award aria-hidden="true" className="size-6 text-primary" />
            {t("learner.doneTitle")}
          </h2>
          <p className="text-sm">{t("learner.doneText")}</p>
          <Button asChild>
            <Link href={{ pathname: "/academy/certificate/[code]", params: { code: course.certificate_code } }}>{t("learner.certificate")}</Link>
          </Button>
        </section>
      ) : course.next_lesson_id ? (
        <div>
          <Button asChild size="lg">
            <Link href={lessonHref(course.next_lesson_id)}>{course.progress.lessons_done > 0 ? t("learner.resume") : t("learner.start")}</Link>
          </Button>
        </div>
      ) : null}

      <p className="max-w-3xl text-sm text-muted-foreground">{t("learner.rules", { percent: course.pass_percent })}</p>

      <section aria-labelledby="learner-outline" className="flex flex-col gap-4">
        <h2 id="learner-outline" className="text-heading-lg font-semibold">{t("course.outline")}</h2>
        <ol className="flex flex-col gap-4">
          {course.outline.map((module, index) => (
            <li key={module.id} className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t("course.module", { number: index + 1 })}</p>
              <h3 className="text-heading-sm font-semibold">{module.title}</h3>
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center gap-3 py-2.5">
                    {lesson.done ? (
                      <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
                    ) : lesson.has_video ? (
                      <PlayCircle aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Circle aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                    )}
                    <Link href={lessonHref(lesson.id)} className="flex-1 underline-offset-4 hover:text-primary hover:underline">
                      {lesson.title}
                      {lesson.done ? <span className="sr-only"> ({t("learner.lessonDone")})</span> : null}
                    </Link>
                    <span className="text-xs text-muted-foreground">{t("lesson.duration", { minutes: lesson.duration_minutes })}</span>
                  </li>
                ))}
              </ul>
              {module.questions > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <ClipboardCheck aria-hidden="true" className="size-5 text-primary" />
                    {t("learner.quiz")} ·{" "}
                    {module.quiz_passed
                      ? t("learner.quizPassed", { score: module.best_score ?? 100 })
                      : module.best_score !== null && module.best_score !== undefined
                        ? t("learner.quizBest", { score: module.best_score })
                        : t("learner.quizTodo")}
                  </span>
                  <Button asChild size="sm" variant={module.quiz_passed ? "outline" : "secondary"}>
                    <Link href={{ pathname: "/account/academy/[course]/quiz/[module]", params: { course: slug, module: module.id } }}>
                      {module.best_score !== null && module.best_score !== undefined ? t("learner.retakeQuiz") : t("learner.takeQuiz")}
                      <span className="sr-only"> : {module.title}</span>
                    </Link>
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      {course.description_html ? (
        <div className="max-w-3xl">
          <Prose html={course.description_html} />
        </div>
      ) : null}
    </>
  );
}
