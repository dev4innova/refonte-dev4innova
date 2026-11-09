import { ArrowLeft, ClipboardCheck, ExternalLink, Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CourseActions } from "@/components/academy-admin/course-actions";
import { CourseForm } from "@/components/academy-admin/course-form";
import { EnrollPanel, RemoveEnrollment } from "@/components/academy-admin/enrollments";
import { AddLessonForm, ItemActions, ModuleForm } from "@/components/academy-admin/outline-controls";
import { CourseStatus } from "@/components/academy-admin/status";
import { AdminNotice } from "@/components/admin/admin-notice";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pick } from "@/lib/academy";
import { adminLoad } from "@/lib/admin";
import type { MissingItem } from "@/lib/academy";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; id: string }> };

/** A course in the back office: presentation, outline, publication, learners (TASK-103 to TASK-106). */
export default function AcademyCourseAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <AcademyCourseAdmin params={params} />
    </Suspense>
  );
}

async function AcademyCourseAdmin({ params }: Props) {
  const { locale, id } = await params;
  if (!isUuid(id)) notFound();
  const loaded = await adminLoad(getPathname({ locale, href: { pathname: "/admin/academy/[id]", params: { id } } }), async (api) => {
    const path = { params: { path: { course_id: id } } };
    const [course, enrollments, organizations] = await Promise.all([
      api.GET("/api/v1/admin/academy/courses/{course_id}", path),
      api.GET("/api/v1/admin/academy/courses/{course_id}/enrollments", path),
      api.GET("/api/v1/admin/academy/organizations"),
    ]);
    const data =
      course.data && enrollments.data && organizations.data
        ? { course: course.data, enrollments: enrollments.data, organizations: organizations.data }
        : undefined;
    return { data, response: course.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "Admin.academy" }), getFormatter({ locale })]);
  const { course, enrollments, organizations } = loaded.data;
  const name = pick(course.title, locale);
  const published = course.status === "published";
  const missingLabel = (m: MissingItem) =>
    `${m.kind === "course" ? t("missing.course") : t(`missing.${m.kind}`, { ref: m.ref ?? "" })} : ${t(`missing.fields.${m.field}` as "missing.fields.title")}`;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/admin/academy" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("course.back")}
      </Link>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-md font-semibold break-words">{name}</h1>
          <CourseStatus published={published} label={t(`status.${course.status}`)} />
        </div>
        <p className="text-sm text-muted-foreground">{t(`visibility.${course.visibility}`)}</p>
        {published && course.visibility === "public" ? (
          <Link
            href={{ pathname: "/academy/[slug]", params: { slug: course.slug } }}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("course.view")}
            <ExternalLink aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
        <CourseActions id={course.id} name={name} published={published} canPublish={course.missing.length === 0} />
      </div>

      <section aria-labelledby="course-missing" className="rounded-xl border border-border bg-card p-5">
        <h2 id="course-missing" className="text-heading-sm font-semibold">{t("course.missingTitle")}</h2>
        {course.missing.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("course.ready")}</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {course.missing.map((m) => <li key={`${m.kind}-${m.ref}-${m.field}`}>{missingLabel(m)}</li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="course-details" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 id="course-details" className="text-heading-sm font-semibold">{t("course.details")}</h2>
        <CourseForm course={course} />
      </section>

      <section aria-labelledby="course-outline" className="flex flex-col gap-4">
        <h2 id="course-outline" className="text-heading-lg font-semibold">{t("outline.title")}</h2>
        {course.outline.length === 0 ? <p className="text-muted-foreground">{t("outline.noModule")}</p> : null}
        <ol className="flex flex-col gap-4">
          {course.outline.map((module, index) => {
            const moduleName = pick(module.title, locale);
            return (
              <li key={module.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t("outline.module", { number: index + 1 })}</p>
                    <h3 className="text-heading-sm font-semibold break-words">{moduleName}</h3>
                  </div>
                  <ItemActions
                    kind="modules"
                    id={module.id}
                    name={moduleName}
                    first={index === 0}
                    last={index === course.outline.length - 1}
                    confirm={t("outline.deleteModuleConfirm", { name: moduleName })}
                  />
                </div>
                {module.lessons.length === 0 ? <p className="text-sm text-muted-foreground">{t("outline.noLesson")}</p> : null}
                <ol className="flex flex-col divide-y divide-border">
                  {module.lessons.map((lesson, n) => {
                    const lessonName = pick(lesson.title, locale);
                    return (
                      <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="text-sm">
                          <span className="text-muted-foreground">{index + 1}.{n + 1} </span>
                          <Link
                            href={{ pathname: "/admin/academy/[id]/lessons/[lesson]", params: { id: course.id, lesson: lesson.id } }}
                            className="font-medium underline-offset-4 hover:text-primary hover:underline"
                          >
                            {lessonName}
                          </Link>
                        </span>
                        <ItemActions
                          kind="lessons"
                          id={lesson.id}
                          name={lessonName}
                          first={n === 0}
                          last={n === module.lessons.length - 1}
                          confirm={t("outline.deleteLessonConfirm", { name: lessonName })}
                        />
                      </li>
                    );
                  })}
                </ol>
                <AddLessonForm courseId={course.id} moduleId={module.id} />
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <ClipboardCheck aria-hidden="true" className="size-5 text-primary" />
                    {t("outline.quiz", { count: module.questions.length })}
                  </span>
                  <Link
                    href={{ pathname: "/admin/academy/[id]/quiz/[module]", params: { id: course.id, module: module.id } }}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {t("outline.editQuiz")}
                    <span className="sr-only"> : {moduleName}</span>
                  </Link>
                </div>
                <details className="rounded-lg border border-border p-3">
                  <summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Pencil aria-hidden="true" className="size-4" />
                    {t("outline.editModule")}
                    <span className="sr-only"> : {moduleName}</span>
                  </summary>
                  <div className="mt-3">
                    <ModuleForm courseId={course.id} module={{ id: module.id, title: { fr: module.title.fr ?? "", en: module.title.en ?? "" }, summary: { fr: module.summary.fr ?? "", en: module.summary.en ?? "" } }} />
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-heading-sm font-semibold">{t("outline.addModule")}</h3>
          <ModuleForm courseId={course.id} />
        </div>
      </section>

      <section aria-labelledby="course-learners" className="flex flex-col gap-4">
        <h2 id="course-learners" className="text-heading-lg font-semibold">{t("enrollments.title")}</h2>
        {enrollments.length === 0 ? (
          <p className="text-muted-foreground">{t("enrollments.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {enrollments.map((e) => {
              const learner = e.learner.display_name ?? e.learner.email ?? "";
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{learner}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.sponsor ? e.sponsor.name : t("enrollments.self")} · {e.progress.percent} % ·{" "}
                      {format.dateTime(new Date(e.last_activity_at), { dateStyle: "medium" })}
                      {e.certificate_code ? <> · {e.certificate_code}</> : null}
                    </span>
                  </div>
                  <RemoveEnrollment id={e.id} name={learner} />
                </li>
              );
            })}
          </ul>
        )}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-heading-sm font-semibold">{t("enrollments.enrollTitle")}</h3>
          {published ? (
            <EnrollPanel courseId={course.id} organizations={organizations} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("enrollments.draft")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
