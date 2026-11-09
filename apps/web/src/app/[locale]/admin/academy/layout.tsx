import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";

type Props = Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>;

/** Academy area of the back office (EPIC 12): shares the Academy messages (levels...). */
export default async function AcademyAdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ Admin: messages.Admin, Academy: messages.Academy }}>
      {children}
    </NextIntlClientProvider>
  );
}
