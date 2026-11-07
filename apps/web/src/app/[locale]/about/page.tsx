import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

const VALUES = ["pragmatism", "transparency", "responsibility", "transmission"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return pageMetadata({
    locale,
    href: "/about",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** About page (TASK-048). */
export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([getTranslations("About"), getTranslations("Common")]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Section variant="card">
        <div className="grid gap-12 md:grid-cols-2">
          {(["mission", "approach"] as const).map((block) => (
            <div key={block} className="flex flex-col gap-4">
              <h2 className="text-display-md font-semibold">{t(`${block}.title`)}</h2>
              <p className="text-lg text-muted-foreground">{t(`${block}.text`)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section aria-labelledby="about-values">
        <h2 id="about-values" className="mb-10 text-display-md font-semibold">
          {t("values.title")}
        </h2>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <li key={value} className="flex flex-col gap-3 border-t-2 border-primary pt-5">
              <h3 className="text-heading-sm font-semibold">{t(`values.${value}.title`)}</h3>
              <p className="text-muted-foreground">{t(`values.${value}.text`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand title={t("ctaTitle")} text={t("ctaText")} actionLabel={tCommon("contactUs")} />
    </>
  );
}
