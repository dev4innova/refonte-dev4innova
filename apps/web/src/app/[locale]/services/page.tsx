import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { OfferGrid } from "@/components/marketing/offer-grid";
import { PageHeader } from "@/components/marketing/page-header";
import { SERVICES } from "@/config/offer";
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

/** Services index (TASK-050). */
export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([getTranslations("Services"), getTranslations("Common")]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card">
        <OfferGrid
          linkLabel={tCommon("learnMore")}
          items={SERVICES.map(({ slug, icon }) => ({
            key: slug,
            icon,
            title: t(`items.${slug}.title`),
            summary: t(`items.${slug}.summary`),
            href: { pathname: "/services/[slug]", params: { slug } },
          }))}
        />
      </Section>
      <CtaBand title={t("ctaTitle")} text={t("ctaText")} actionLabel={tCommon("contactUs")} />
    </>
  );
}
