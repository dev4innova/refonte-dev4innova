import { ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { MarkLessonDone } from "@/components/academy/lesson-controls";
import { Prose } from "@/components/cms/prose";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learnerApi } from "@/lib/academy-learner";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; course: string; lesson: string }> };

/** A lesson: text, optional video, done button, previous and next (TASK-105, TASK-107). */
export default function LessonPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Lesson params={params} />
    </Suspense>
  );
}

async function Lesson({ params }: Props) {
  const { locale, course: slug, lesson: lessonId } = await params;
  if (!isUuid(lessonId)) notFound();
  const api = await learnerApi(locale, {
    pathname: "/account/academy/[course]/lessons/[lesson]",
    params: { course: slug, lesson: lessonId },
  });
  const [lessonResult, courseResult] = await Promise.all([
    api.GET("/api/v1/me/academy/lessons/{lesson_id}", { params: { path: { lesson_id: lessonId }, query: { locale } } }).catch(() => undefined),
    api.GET("/api/v1/me/academy/courses/{slug}", { params: { path: { slug }, query: { locale } } }).catch(() => undefined),
  ]);
  if (lessonResult?.response.status === 404 || courseResult?.response.status === 404) notFound();
  const t = await getTranslations({ locale, namespace: "Academy" });
  const lesson = lessonResult?.data;
  const course = courseResult?.data;
  if (!lesson || !course) return <p role="alert" className="text-destructive">{t("errors.generic")}</p>;
  if (lesson.course_slug !== slug) notFound();

  const courseModule = course.outline.find((m) => m.id === lesson.module_id);
  const lastOfModule = courseModule?.lessons.at(-1)?.id === lesson.id;
  const quizNext = lesson.module_has_quiz && lastOfModule && !courseModule?.quiz_passed;
  const next = quizNext ? { quiz: lesson.module_id } : lesson.next_lesson_id ? { lesson: lesson.next_lesson_id } : null;
  const lessonHref = (id: string) => ({ pathname: "/account/academy/[course]/lessons/[lesson]" as const, params: { course: slug, lesson: id } });

  return (
    <article className="flex flex-col gap-8">
      <nav aria-label={course.course.title} className="flex flex-col gap-1">
        <Link
          href={{ pathname: "/account/academy/[course]", params: { course: slug } }}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {lesson.course_title}
        </Link>
        <p className="text-sm text-muted-foreground">{t("lesson.module", { name: lesson.module_title })}</p>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{lesson.title}</h1>
        <p className="text-sm text-muted-foreground">{t("lesson.duration", { minutes: lesson.duration_minutes })}</p>
      </header>
      {lesson.video_url ? (
        <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-muted">
          <iframe
            src={lesson.video_url}
            title={t("lesson.video", { name: lesson.title })}
            className="size-full"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      ) : null}
      {lesson.body_html ? (
        <div className="max-w-3xl">
          <Prose html={lesson.body_html} />
        </div>
      ) : null}
      <div className="flex max-w-3xl flex-col gap-6 border-t border-border pt-6">
        <MarkLessonDone lessonId={lesson.id} course={slug} done={lesson.done} next={next} />
        {lesson.done && course.certificate_code ? (
          <Link
            href={{ pathname: "/academy/certificate/[code]", params: { code: course.certificate_code } }}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("lesson.certificate")}
          </Link>
        ) : null}
        <div className="flex flex-wrap justify-between gap-4">
          {lesson.previous_lesson_id ? (
            <Link href={lessonHref(lesson.previous_lesson_id)} className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:text-primary hover:underline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("lesson.previous")}
            </Link>
          ) : (
            <span />
          )}
          {lesson.module_has_quiz && lastOfModule ? (
            <Link
              href={{ pathname: "/account/academy/[course]/quiz/[module]", params: { course: slug, module: lesson.module_id } }}
              className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
            >
              <ClipboardCheck aria-hidden="true" className="size-4" />
              {t("lesson.toQuiz")}
            </Link>
          ) : null}
          {lesson.next_lesson_id ? (
            <Link href={lessonHref(lesson.next_lesson_id)} className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:text-primary hover:underline">
              {t("lesson.next")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
