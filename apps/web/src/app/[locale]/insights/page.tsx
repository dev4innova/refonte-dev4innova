import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
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
  const t = await getTranslations({ locale, namespace: "Insights" });
  return pageMetadata({
    locale,
    href: "/insights",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Insights index, fed by the CMS (EPIC 06). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Insights");

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
  const [items, t, tCommon, format] = await Promise.all([
    getContentList("article", locale),
    getTranslations({ locale, namespace: "Insights" }),
    getTranslations({ locale, namespace: "Common" }),
    getFormatter({ locale }),
  ]);

  if (items.length === 0) {
    return (
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
    );
  }

  return (
    <ContentGrid
      items={items.map((item) => ({
        key: item.id,
        title: item.title,
        summary: item.summary,
        cover: item.cover,
        meta: item.published_at
          ? format.dateTime(new Date(item.published_at), { dateStyle: "long" })
          : undefined,
        href: { pathname: "/insights/[slug]", params: { slug: item.slug } },
      }))}
    />
  );
}
