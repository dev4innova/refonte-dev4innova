import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LessonEditor } from "@/components/academy-admin/lesson-editor";
import { AdminNotice } from "@/components/admin/admin-notice";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pick } from "@/lib/academy";
import { adminLoad } from "@/lib/admin";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; id: string; lesson: string }> };

/** Lesson editor of the back office (TASK-105). */
export default function AcademyLessonAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <AcademyLessonAdmin params={params} />
    </Suspense>
  );
}

async function AcademyLessonAdmin({ params }: Props) {
  const { locale, id, lesson: lessonId } = await params;
  if (!isUuid(id) || !isUuid(lessonId)) notFound();
  const loaded = await adminLoad(
    getPathname({ locale, href: { pathname: "/admin/academy/[id]/lessons/[lesson]", params: { id, lesson: lessonId } } }),
    async (api) => {
      const [course, lesson] = await Promise.all([
        api.GET("/api/v1/admin/academy/courses/{course_id}", { params: { path: { course_id: id } } }),
        api.GET("/api/v1/admin/academy/lessons/{lesson_id}", { params: { path: { lesson_id: lessonId } } }),
      ]);
      return { data: course.data && lesson.data ? { course: course.data, lesson: lesson.data } : undefined, response: lesson.response };
    },
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const t = await getTranslations({ locale, namespace: "Admin.academy" });
  const { course, lesson } = loaded.data;
  const moduleIndex = course.outline.findIndex((m) => m.id === lesson.module_id);
  if (moduleIndex < 0) notFound();
  const lessonIndex = course.outline[moduleIndex]!.lessons.findIndex((l) => l.id === lesson.id);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={{ pathname: "/admin/academy/[id]", params: { id } }}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("lesson.back")}
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{pick(course.title, locale)}</p>
        <h1 className="text-display-md font-semibold">{t("lesson.title", { ref: `${moduleIndex + 1}.${lessonIndex + 1}` })}</h1>
      </div>
      <LessonEditor lesson={lesson} />
    </div>
  );
}
