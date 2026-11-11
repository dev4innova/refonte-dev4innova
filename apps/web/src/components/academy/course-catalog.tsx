import { ArrowRight, Clock, GraduationCap } from "lucide-react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { duration } from "@/lib/academy";
import { getCatalog } from "@/lib/academy-server";

/** Open courses of the Academy (TASK-103). Render inside <Suspense>: cached API data. */
export async function CourseCatalog({ locale }: { locale: Locale }) {
  await connection(); // API data: request time (cached), never frozen at build
  const [t, courses] = await Promise.all([getTranslations({ locale, namespace: "Academy" }), getCatalog(locale)]);
  if (courses === null) return <p className="text-muted-foreground">{t("catalog.unavailable")}</p>;
  if (courses.length === 0) return <p className="text-muted-foreground">{t("catalog.empty")}</p>;
  const units = { hour: t("units.hour"), minute: t("units.minute") };
  return (
    <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <li key={course.id} className="flex">
          <Card className="flex w-full flex-col">
            <CardHeader>
              <p className="text-xs font-semibold tracking-wide text-primary-ink uppercase">{t(`levels.${course.level}`)}</p>
              <CardTitle>{course.title}</CardTitle>
              <CardDescription>{course.summary}</CardDescription>
            </CardHeader>
            <div className="mt-auto flex flex-col gap-4">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap aria-hidden="true" className="size-4" />
                  {t("catalog.stats", { modules: course.modules, lessons: course.lessons })}
                </span>
                {course.duration_minutes ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden="true" className="size-4" />
                    {duration(course.duration_minutes, units)}
                  </span>
                ) : null}
              </p>
              <Link
                href={{ pathname: "/academy/[slug]", params: { slug: course.slug } }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
                aria-label={t("catalog.seeName", { name: course.title })}
              >
                {t("catalog.see")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
