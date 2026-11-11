import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DiagnosticForm } from "@/components/diagnostic/diagnostic-form";
import { Section } from "@/components/layout/section";
import { PageHeader } from "@/components/marketing/page-header";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";
import { getQuestionnaire } from "@/lib/diagnostic-server";

type Props = { params: Promise<{ locale: Locale }> };

const POINTS = ["a", "b", "c"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Diagnostic" });
  return pageMetadata({ locale, href: "/diagnostic", title: t("metaTitle"), description: t("metaDescription") });
}

/** Public AI maturity diagnostic (TASK-089). */
export default async function DiagnosticPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Diagnostic");
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Suspense fallback={<div aria-hidden="true" className="h-[32rem] animate-pulse rounded-xl bg-muted" />}>
            <Questionnaire locale={locale} />
          </Suspense>
          <aside aria-labelledby="diagnostic-how" className="flex flex-col gap-5">
            <h2 id="diagnostic-how" className="text-heading-lg font-semibold">{t("asideTitle")}</h2>
            <ul className="flex flex-col gap-4">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-ink" />
                  <span>{t(`asidePoints.${point}`)}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Section>
    </>
  );
}

async function Questionnaire({ locale }: { locale: Locale }) {
  await connection(); // the questionnaire comes from the API, at request time (cached)
  const [questionnaire, t] = await Promise.all([getQuestionnaire(locale), getTranslations({ locale, namespace: "Diagnostic" })]);
  if (!questionnaire) {
    return <p role="alert" className="rounded-xl border border-destructive bg-accent p-6 text-accent-foreground">{t("errors.unavailable")}</p>;
  }
  return <DiagnosticForm questionnaire={questionnaire} locale={locale} />;
}
