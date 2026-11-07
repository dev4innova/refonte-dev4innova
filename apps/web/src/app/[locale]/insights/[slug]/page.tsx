import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CmsDetail, CmsDetailSkeleton, cmsMetadata } from "@/components/cms/cms-detail";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return cmsMetadata("article", "/insights/[slug]", locale, slug);
}

/** Insights detail from the CMS (EPIC 06). */
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<CmsDetailSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Props) {
  const { locale } = await params;
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Insights" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  return (
    <CmsDetail
      type="article"
      pathname="/insights/[slug]"
      params={params}
      sectionLabel={t("eyebrow")}
      cta={{ title: t("ctaTitle"), text: t("ctaText"), actionLabel: tCommon("contactUs") }}
    />
  );
}
