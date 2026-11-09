import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import { Container } from "@/components/layout/container";
import type { Locale } from "@/i18n/routing";

type Props = Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Portal" });
  // Private area: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Client portal (EPIC 11). Client components receive only the Portal messages. */
export default async function PortalLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ Portal: messages.Portal, Billing: messages.Billing }}>
      <Container className="flex flex-col gap-8 py-10">{children}</Container>
    </NextIntlClientProvider>
  );
}
