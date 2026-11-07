import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ContentGridSkeleton } from "@/components/cms/content-grid";
import { ServicesGrid } from "@/components/cms/services-grid";
import { Section } from "@/components/layout/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Services" });
  return pageMetadata({
    locale,
    href: "/services",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Services index (TASK-050); the services themselves come from the CMS (TASK-063). */
export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([getTranslations("Services"), getTranslations("Common")]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card">
        <Suspense fallback={<ContentGridSkeleton count={5} />}>
          <ServicesGrid locale={locale} linkLabel={tCommon("learnMore")} />
        </Suspense>
      </Section>
      <CtaBand title={t("ctaTitle")} text={t("ctaText")} actionLabel={tCommon("contactUs")} />
    </>
  );
}
