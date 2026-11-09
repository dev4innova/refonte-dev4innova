import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ItemActions } from "@/components/academy-admin/outline-controls";
import { QuestionEditor } from "@/components/academy-admin/question-editor";
import { AdminNotice } from "@/components/admin/admin-notice";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pick } from "@/lib/academy";
import { adminLoad } from "@/lib/admin";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; id: string; module: string }> };

/** Quiz editor of a module (TASK-108). */
export default function AcademyQuizAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <AcademyQuizAdmin params={params} />
    </Suspense>
  );
}

async function AcademyQuizAdmin({ params }: Props) {
  const { locale, id, module: moduleId } = await params;
  if (!isUuid(id) || !isUuid(moduleId)) notFound();
  const loaded = await adminLoad(
    getPathname({ locale, href: { pathname: "/admin/academy/[id]/quiz/[module]", params: { id, module: moduleId } } }),
    (api) => api.GET("/api/v1/admin/academy/courses/{course_id}", { params: { path: { course_id: id } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const courseModule = loaded.data.outline.find((m) => m.id === moduleId);
  if (!courseModule) notFound();
  const t = await getTranslations({ locale, namespace: "Admin.academy" });
  const name = pick(courseModule.title, locale);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={{ pathname: "/admin/academy/[id]", params: { id } }}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("quiz.back")}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold break-words">{t("quiz.title", { name })}</h1>
        <p className="text-muted-foreground">{t("quiz.lead")}</p>
      </div>
      {courseModule.questions.length === 0 ? <p className="text-muted-foreground">{t("quiz.empty")}</p> : null}
      <ol className="flex flex-col gap-4">
        {courseModule.questions.map((question, index) => (
          <li key={question.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-heading-sm font-semibold">{t("quiz.question", { number: index + 1 })}</h2>
              <ItemActions
                kind="questions"
                id={question.id}
                name={t("quiz.question", { number: index + 1 })}
                first={index === 0}
                last={index === courseModule.questions.length - 1}
                confirm={t("quiz.deleteConfirm")}
              />
            </div>
            <QuestionEditor moduleId={courseModule.id} question={question} />
          </li>
        ))}
      </ol>
      <section aria-labelledby="quiz-new" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 id="quiz-new" className="text-heading-sm font-semibold">{t("quiz.addTitle")}</h2>
        <QuestionEditor moduleId={courseModule.id} />
      </section>
    </div>
  );
}
