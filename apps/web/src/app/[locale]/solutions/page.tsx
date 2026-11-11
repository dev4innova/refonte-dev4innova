import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { illustrationLabels } from "@/components/illustrations/labels";
import { SignalToSystemCompact } from "@/components/illustrations/signal-to-system";
import { PageHeader } from "@/components/marketing/page-header";
import { solutionItems } from "@/components/marketing/solution-items";
import { SolutionsBento } from "@/components/marketing/solutions-bento";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Solutions" });
  return pageMetadata({
    locale,
    href: "/solutions",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Solutions index (TASK-049). */
export default async function SolutionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon, tIllu] = await Promise.all([
    getTranslations("Solutions"),
    getTranslations("Common"),
    getTranslations("Illustrations"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        illustration={<SignalToSystemCompact />}
      />
      <Section variant="tint" aria-label={t("title")}>
        <SolutionsBento
          items={solutionItems(t)}
          labels={illustrationLabels(tIllu).solutions}
          linkLabel={tCommon("learnMore")}
          headingLevel="h2"
        />
      </Section>
      <CtaBand title={t("ctaTitle")} text={t("ctaText")} actionLabel={tCommon("contactUs")} />
    </>
  );
}
