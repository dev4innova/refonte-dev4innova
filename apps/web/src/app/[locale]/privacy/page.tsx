import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage, legalMetadata } from "@/components/cms/legal-page";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata("/privacy", locale);
}

/** Legal page, written in the CMS (TASK-061). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage pathname="/privacy" locale={locale} />;
}
