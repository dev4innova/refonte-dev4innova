import { CheckCircle2, ClipboardCheck, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EnrollButton } from "@/components/academy/enroll-button";
import { Prose } from "@/components/cms/prose";
import { Section } from "@/components/layout/section";
import { Breadcrumb } from "@/components/marketing/breadcrumb";
import { PageHeader } from "@/components/marketing/page-header";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/i18n/metadata";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { duration } from "@/lib/academy";
import { getCourse } from "@/lib/academy-server";
import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/auth/session";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const course = await getCourse(locale, slug);
  if (!course) return { robots: { index: false } };
  return pageMetadata({
    locale,
    href: { pathname: "/academy/[slug]", params: { slug } },
    title: course.title,
    description: course.summary,
  });
}

/** Public page of an open course: presentation, outline and enrollment (TASK-103). */
export default function CoursePage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-[32rem] animate-pulse bg-muted" />}>
      <Course params={params} />
    </Suspense>
  );
}

async function Course({ params }: Props) {
  const { locale, slug } = await params;
  await connection();
  const course = await getCourse(locale, slug);
  if (!course) notFound();
  const [t, tCommon, tPage, messages] = await Promise.all([
    getTranslations({ locale, namespace: "Academy" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "AcademyPage" }),
    getMessages({ locale }),
  ]);
  const units = { hour: t("units.hour"), minute: t("units.minute") };

  return (
    <>
      <PageHeader
        eyebrow={t("course.eyebrow")}
        title={course.title}
        lead={course.summary}
        before={
          <Breadcrumb
            label={tCommon("breadcrumb")}
            items={[{ label: tCommon("home"), href: "/" }, { label: tPage("eyebrow"), href: "/academy" }, { label: course.title }]}
          />
        }
      >
        <p className="flex flex-wrap gap-x-6 gap-y-2 text-inverse-muted-foreground">
          <span>{t("course.level", { level: t(`levels.${course.level}`) })}</span>
          {course.duration_minutes ? <span>{t("course.duration", { duration: duration(course.duration_minutes, units) })}</span> : null}
          <span>{t("catalog.stats", { modules: course.modules, lessons: course.lessons })}</span>
        </p>
      </PageHeader>
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-10">
            {course.description_html ? <Prose html={course.description_html} /> : null}
            <section aria-labelledby="course-outline" className="flex flex-col gap-4">
              <h2 id="course-outline" className="text-display-md font-semibold">{t("course.outline")}</h2>
              <ol className="flex flex-col gap-4">
                {course.outline.map((module, index) => (
                  <li key={module.id} className="rounded-xl border border-border bg-card p-5">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t("course.module", { number: index + 1 })}</p>
                    <h3 className="text-heading-sm font-semibold">{module.title}</h3>
                    {module.summary ? <p className="mt-1 text-sm text-muted-foreground">{module.summary}</p> : null}
                    <ul className="mt-3 flex flex-col gap-2">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-start gap-2 text-sm">
                          {lesson.has_video ? (
                            <PlayCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                          ) : (
                            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1">
                            {lesson.title}
                            {lesson.has_video ? <span className="sr-only"> ({t("course.video")})</span> : null}
                          </span>
                          <span className="text-muted-foreground">{duration(lesson.duration_minutes, units)}</span>
                        </li>
                      ))}
                      {module.questions > 0 ? (
                        <li className="flex items-start gap-2 text-sm font-medium">
                          <ClipboardCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                          {t("course.quiz", { count: module.questions })}
                        </li>
                      ) : null}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <aside aria-labelledby="course-enroll" className="flex flex-col gap-4 self-start rounded-xl border border-border bg-card p-6 shadow-card lg:sticky lg:top-24">
            <h2 id="course-enroll" className="text-heading-sm font-semibold">{t("course.enrollTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("course.enrollText")}</p>
            <NextIntlClientProvider messages={{ Academy: messages.Academy }}>
              <Suspense fallback={<div aria-hidden="true" className="h-13 animate-pulse rounded-lg bg-muted" />}>
                <EnrollBox locale={locale} slug={course.slug} />
              </Suspense>
            </NextIntlClientProvider>
          </aside>
        </div>
      </Section>
    </>
  );
}

/** Enrollment state of the visitor: sign in, enroll, or continue (request-time data). */
async function EnrollBox({ locale, slug }: { locale: Locale; slug: string }) {
  const t = await getTranslations({ locale, namespace: "Academy" });
  const session = await getSession();
  if (!session) {
    const returnTo = getPathname({ locale, href: { pathname: "/academy/[slug]", params: { slug } } });
    return (
      <Button asChild size="lg" variant="secondary">
        <a href={`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>{t("course.signIn")}</a>
      </Button>
    );
  }
  const { response } = await serverApi(session.accessToken)
    .GET("/api/v1/me/academy/courses/{slug}", { params: { path: { slug }, query: { locale } } })
    .catch(() => ({ response: undefined }));
  if (response?.ok) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("course.enrolled")}</p>
        <Button asChild size="lg">
          <Link href={{ pathname: "/account/academy/[course]", params: { course: slug } }}>{t("course.continue")}</Link>
        </Button>
      </div>
    );
  }
  return <EnrollButton slug={slug} locale={locale} />;
}
