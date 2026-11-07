import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CmsDetail, CmsDetailSkeleton, cmsMetadata } from "@/components/cms/cms-detail";
import { ServicesGrid } from "@/components/cms/services-grid";
import { Section } from "@/components/layout/section";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return cmsMetadata("service", "/services/[slug]", locale, slug);
}

/** Service detail from the CMS (TASK-050, TASK-063). */
export default function ServicePage({ params }: Props) {
  return (
    <Suspense fallback={<CmsDetailSkeleton />}>
      <ServiceContent params={params} />
    </Suspense>
  );
}

async function ServiceContent({ params }: Props) {
  const { locale } = await params;
  const [t, tCommon, tQuote] = await Promise.all([
    getTranslations({ locale, namespace: "Services" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Quote" }),
  ]);
  return (
    <CmsDetail
      type="service"
      pathname="/services/[slug]"
      params={params}
      sectionLabel={t("eyebrow")}
      cta={{
        title: t("ctaTitle"),
        text: t("ctaText"),
        actionLabel: tCommon("contactUs"),
        secondary: (content) => ({
          label: tQuote("cta"),
          href: { pathname: "/quote", query: { service: content.slug } },
        }),
      }}
    >
      {(content) => (
        <Section aria-label={tCommon("allServices")}>
          <h2 className="mb-10 text-display-md font-semibold">{tCommon("allServices")}</h2>
          <ServicesGrid locale={locale} linkLabel={tCommon("learnMore")} exclude={content.id} />
        </Section>
      )}
    </CmsDetail>
  );
}
