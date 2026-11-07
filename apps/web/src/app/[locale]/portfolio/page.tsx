import { BriefcaseBusiness } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ContentGrid, ContentGridSkeleton } from "@/components/cms/content-grid";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/marketing/empty-state";
import { PageHeader } from "@/components/marketing/page-header";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getContentList } from "@/lib/cms";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Portfolio" });
  return pageMetadata({
    locale,
    href: "/portfolio",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Portfolio index, fed by the CMS (EPIC 06). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Portfolio");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card">
        <Suspense fallback={<ContentGridSkeleton />}>
          <Items locale={locale} />
        </Suspense>
      </Section>
    </>
  );
}

async function Items({ locale }: { locale: Locale }) {
  await connection();
  const [items, t, tCommon] = await Promise.all([
    getContentList("project", locale),
    getTranslations({ locale, namespace: "Portfolio" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title={t("emptyTitle")}
        text={t("emptyText")}
        action={
          <Button asChild variant="outline">
            <Link href="/contact">{tCommon("contactUs")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ContentGrid
      items={items.map((item) => ({
        key: item.id,
        title: item.title,
        summary: item.summary,
        cover: item.cover,
        meta: item.attributes.industry,
        href: { pathname: "/portfolio/[slug]", params: { slug: item.slug } },
      }))}
    />
  );
}
