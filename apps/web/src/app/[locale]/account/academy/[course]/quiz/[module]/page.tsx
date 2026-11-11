import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { QuizForm } from "@/components/academy/quiz-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learnerApi } from "@/lib/academy-learner";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; course: string; module: string }> };

/** Quiz of a module (TASK-108). */
export default function QuizPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Quiz params={params} />
    </Suspense>
  );
}

async function Quiz({ params }: Props) {
  const { locale, course: slug, module: moduleId } = await params;
  if (!isUuid(moduleId)) notFound();
  const api = await learnerApi(locale, {
    pathname: "/account/academy/[course]/quiz/[module]",
    params: { course: slug, module: moduleId },
  });
  const { data: quiz, response } = await api
    .GET("/api/v1/me/academy/quizzes/{module_id}", { params: { path: { module_id: moduleId }, query: { locale } } })
    .catch(() => ({ data: undefined, response: undefined }));
  if (response?.status === 404 || (quiz && quiz.course_slug !== slug)) notFound();
  const t = await getTranslations({ locale, namespace: "Academy" });
  if (!quiz) return <p role="alert" className="text-destructive">{t("errors.generic")}</p>;
  return (
    <>
      <Link
        href={{ pathname: "/account/academy/[course]", params: { course: slug } }}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {quiz.course_title}
      </Link>
      <div className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("quiz.title", { name: quiz.module_title })}</h1>
        <p className="text-muted-foreground">{t("quiz.lead", { percent: quiz.pass_percent })}</p>
        {quiz.best_score !== null && quiz.best_score !== undefined ? (
          <p className="text-sm font-medium">{t("quiz.best", { score: quiz.best_score })}</p>
        ) : null}
      </div>
      <QuizForm quiz={quiz} locale={locale} />
    </>
  );
}
