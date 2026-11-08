import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";

type Props = Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>;

/** Client components of the diagnostic receive only its messages. */
export default async function DiagnosticLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const messages = await getMessages();
  return <NextIntlClientProvider messages={{ Diagnostic: messages.Diagnostic }}>{children}</NextIntlClientProvider>;
}
