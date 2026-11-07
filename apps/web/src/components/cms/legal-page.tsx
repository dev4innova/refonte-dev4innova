import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/marketing/empty-state";
import { PageHeader } from "@/components/marketing/page-header";
import { localeAlternates } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";
import { getContent } from "@/lib/cms";

import { CmsDetailSkeleton } from "./cms-detail";
import { Prose } from "./prose";

/*
 * Legal pages are CMS documents of type "page" with fixed slugs (create them in the back
 * office with exactly these slugs). Until they are published, a "being written" notice is
 * shown and the page is not indexed.
 */
export const LEGAL_PAGES = {
  "/legal-notice": { key: "legalNotice", slugs: { fr: "mentions-legales", en: "legal-notice" } },
  "/privacy": { key: "privacy", slugs: { fr: "confidentialite", en: "privacy" } },
} as const;

type LegalPathname = keyof typeof LEGAL_PAGES;

export async function legalMetadata(pathname: LegalPathname, locale: Locale): Promise<Metadata> {
  await connection(); // CMS data: request time, never frozen at build
  const { key, slugs } = LEGAL_PAGES[pathname];
  const [t, content] = await Promise.all([
    getTranslations({ locale, namespace: "Legal" }),
    getContent("page", locale, slugs[locale]),
  ]);
  return {
    title: content?.seo_title || content?.title || t(`${key}.metaTitle`),
    description: content?.seo_description || content?.summary || undefined,
    robots: content ? undefined : { index: false, follow: true },
    alternates: localeAlternates(locale, pathname),
  };
}

export function LegalPage({ pathname, locale }: { pathname: LegalPathname; locale: Locale }) {
  return (
    <Suspense fallback={<CmsDetailSkeleton />}>
      <LegalContent pathname={pathname} locale={locale} />
    </Suspense>
  );
}

async function LegalContent({ pathname, locale }: { pathname: LegalPathname; locale: Locale }) {
  await connection();
  const { key, slugs } = LEGAL_PAGES[pathname];
  const [t, content] = await Promise.all([
    getTranslations({ locale, namespace: "Legal" }),
    getContent("page", locale, slugs[locale]),
  ]);

  if (!content) {
    return (
      <>
        <PageHeader title={t(`${key}.title`)} />
        <Section variant="card">
          <EmptyState icon={FileText} title={t("pendingTitle")} text={t("pendingText")} />
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={content.title} lead={content.summary || undefined} />
      <Section variant="card">
        <Prose html={content.body_html} />
      </Section>
    </>
  );
}
