import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ServicesList, ServicesListSkeleton } from "@/components/cms/services-list";
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
  const [t, tCommon, tHome] = await Promise.all([
    getTranslations("Services"),
    getTranslations("Common"),
    getTranslations("Home"),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card" aria-label={t("title")}>
        <Suspense fallback={<ServicesListSkeleton />}>
          <ServicesList
            locale={locale}
            empty={<p className="border-y border-border py-6 text-muted-foreground">{tHome("services.empty")}</p>}
          />
        </Suspense>
      </Section>
      <CtaBand title={t("ctaTitle")} text={t("ctaText")} actionLabel={tCommon("contactUs")} />
    </>
  );
}
