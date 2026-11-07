import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/marketing/empty-state";
import { PageHeader } from "@/components/marketing/page-header";
import { localeAlternates } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return {
    title: t("legalNotice.metaTitle"),
    // Not indexed until the legal text is written and validated.
    robots: { index: false, follow: true },
    alternates: localeAlternates(locale, "/legal-notice"),
  };
}

/** Placeholder: the legal text must be written and validated by DEV4INNOVA before go-live. */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");

  return (
    <>
      <PageHeader title={t("legalNotice.title")} />
      <Section variant="card">
        <EmptyState icon={FileText} title={t("pendingTitle")} text={t("pendingText")} />
      </Section>
    </>
  );
}
