import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/marketing/empty-state";
import { PageHeader } from "@/components/marketing/page-header";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Insights" });
  return pageMetadata({
    locale,
    href: "/insights",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Insights (TASK-054). Articles will come from the CMS (EPIC 06). */
export default async function InsightsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([getTranslations("Insights"), getTranslations("Common")]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card">
        <EmptyState
          icon={Newspaper}
          title={t("emptyTitle")}
          text={t("emptyText")}
          action={
            <Button asChild variant="outline">
              <Link href="/contact">{tCommon("contactUs")}</Link>
            </Button>
          }
        />
      </Section>
    </>
  );
}
