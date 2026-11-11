import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CourseForm } from "@/components/academy-admin/course-form";
import { CourseStatus } from "@/components/academy-admin/status";
import { AdminNotice } from "@/components/admin/admin-notice";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pick } from "@/lib/academy";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }> };

/** Courses of the Academy and a form to start one (TASK-103). */
export default function AcademyAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <AcademyAdmin params={params} />
    </Suspense>
  );
}

async function AcademyAdmin({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/academy" }), (api) => api.GET("/api/v1/admin/academy/courses"));
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const t = await getTranslations({ locale, namespace: "Admin.academy" });
  const courses = loaded.data;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>
      <section aria-labelledby="academy-courses" className="flex flex-col gap-4">
        <h2 id="academy-courses" className="sr-only">{t("title")}</h2>
        {courses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-input bg-card p-6 text-center text-sm text-muted-foreground">{t("list.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {courses.map((course) => (
              <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={{ pathname: "/admin/academy/[id]", params: { id: course.id } }}
                    className="font-semibold break-words underline-offset-4 hover:text-primary-ink hover:underline"
                  >
                    {pick(course.title, locale)}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    /{course.slug} · {t(`visibility.${course.visibility}`)} ·{" "}
                    {t("list.stats", { modules: course.modules, lessons: course.lessons, enrollments: course.enrollments, completions: course.completions })}
                  </span>
                </div>
                <CourseStatus published={course.status === "published"} label={t(`status.${course.status}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="academy-new" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 id="academy-new" className="text-heading-sm font-semibold">{t("course.new")}</h2>
        <CourseForm />
      </section>
    </div>
  );
}
