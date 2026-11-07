import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import { Suspense } from "react";

import { AdminNavView } from "@/components/admin/admin-nav";
import { AdminNavLoader } from "@/components/admin/admin-nav-loader";
import { Container } from "@/components/layout/container";
import type { Locale } from "@/i18n/routing";

type Props = Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin" });
  // Private area: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Back office shell (TASK-060). Client components receive only the Admin messages. */
export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [messages, t] = await Promise.all([getMessages(), getTranslations("Admin")]);

  return (
    <NextIntlClientProvider messages={{ Admin: messages.Admin }}>
      <Container className="flex flex-col gap-8 py-10">
        <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary uppercase">
          {t("nav.label")}
        </p>
        <Suspense fallback={<AdminNavView pathname={null} />}>
          <AdminNavLoader />
        </Suspense>
        {children}
      </Container>
    </NextIntlClientProvider>
  );
}
