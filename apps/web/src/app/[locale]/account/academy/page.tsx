import { ArrowLeft, Award } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CourseProgressBar } from "@/components/academy/progress-bar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learnerApi } from "@/lib/academy-learner";

type Props = { params: Promise<{ locale: Locale }> };

/** Courses of the signed-in learner, with progress and certificates (TASK-106, TASK-107). */
export default function MyCoursesPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <MyCourses params={params} />
    </Suspense>
  );
}

async function MyCourses({ params }: Props) {
  const { locale } = await params;
  const api = await learnerApi(locale, "/account/academy");
  const [t, format, courses] = await Promise.all([
    getTranslations({ locale, namespace: "Academy" }),
    getFormatter({ locale }),
    api.GET("/api/v1/me/academy/courses", { params: { query: { locale } } }).then((r) => r.data).catch(() => undefined),
  ]);
  return (
    <>
      <Link href="/account" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("learner.back")}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("learner.title")}</h1>
        <p className="text-muted-foreground">{t("learner.lead")}</p>
      </div>
      {!courses ? (
        <p role="alert" className="text-destructive">{t("errors.generic")}</p>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-input bg-card p-8">
          <p className="text-muted-foreground">{t("learner.empty")}</p>
          <Button asChild variant="secondary">
            <Link href="/academy">{t("learner.browse")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {courses.map((item) => (
            <li key={item.course.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-col gap-1">
                <h2 className="text-heading-sm font-semibold">
                  <Link
                    href={{ pathname: "/account/academy/[course]", params: { course: item.course.slug } }}
                    className="underline-offset-4 hover:text-primary-ink hover:underline"
                  >
                    {item.course.title}
                  </Link>
                </h2>
                {item.sponsor ? <p className="text-xs text-muted-foreground">{t("learner.sponsor", { name: item.sponsor.name })}</p> : null}
              </div>
              <CourseProgressBar progress={item.progress} />
              <div className="mt-auto flex flex-wrap items-center gap-3">
                {item.completed_at ? (
                  <>
                    <span className="text-sm font-medium">{t("learner.completed", { date: format.dateTime(new Date(item.completed_at), { dateStyle: "medium" }) })}</span>
                    {item.certificate_code ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={{ pathname: "/academy/certificate/[code]", params: { code: item.certificate_code } }}>
                          <Award aria-hidden="true" />
                          {t("learner.certificate")}
                        </Link>
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Button asChild size="sm">
                    <Link href={{ pathname: "/account/academy/[course]", params: { course: item.course.slug } }}>
                      {item.progress.percent > 0 ? t("learner.resume") : t("learner.start")}
                      <span className="sr-only"> : {item.course.title}</span>
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
