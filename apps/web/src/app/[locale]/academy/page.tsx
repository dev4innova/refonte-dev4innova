import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { CourseCatalog } from "@/components/academy/course-catalog";

import { Section } from "@/components/layout/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

const THEMES = ["fundamentals", "productivity", "leadership", "technical"] as const;
const FORMATS = ["intra", "workshops", "online"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AcademyPage" });
  return pageMetadata({
    locale,
    href: "/academy",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Academy page (TASK-053) and its catalog of online courses (TASK-103). */
export default async function AcademyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon, tAcademy] = await Promise.all([
    getTranslations("AcademyPage"),
    getTranslations("Common"),
    getTranslations("Academy"),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Section variant="card" aria-labelledby="academy-themes">
        <h2 id="academy-themes" className="mb-10 text-display-md font-semibold">
          {t("themes.title")}
        </h2>
        <ul className="grid gap-6 sm:grid-cols-2">
          {THEMES.map((theme) => (
            <li key={theme} className="flex">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>{t(`themes.${theme}.title`)}</CardTitle>
                  <CardDescription>{t(`themes.${theme}.text`)}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="academy-formats">
        <h2 id="academy-formats" className="mb-10 text-display-md font-semibold">
          {t("formats.title")}
        </h2>
        <ul className="grid gap-8 md:grid-cols-3">
          {FORMATS.map((format) => (
            <li key={format} className="flex flex-col gap-3 border-t-2 border-primary pt-5">
              <h3 className="text-heading-sm font-semibold">{t(`formats.${format}.title`)}</h3>
              <p className="text-muted-foreground">{t(`formats.${format}.text`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section variant="card" aria-labelledby="academy-catalog">
        <div className="mb-10 flex max-w-3xl flex-col gap-3">
          <h2 id="academy-catalog" className="text-display-md font-semibold">
            {tAcademy("catalog.title")}
          </h2>
          <p className="text-muted-foreground">{tAcademy("catalog.lead")}</p>
        </div>
        <Suspense fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <CourseCatalog locale={locale} />
        </Suspense>
      </Section>

      <CtaBand title={t("ctaTitle")} text={t("ctaText")} actionLabel={tCommon("contactUs")} />
    </>
  );
}
