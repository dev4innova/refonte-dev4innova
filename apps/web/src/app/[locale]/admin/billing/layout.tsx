import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { BillingAdminNav, BillingAdminNavView } from "@/components/billing-admin/nav";
import type { Locale } from "@/i18n/routing";

type Props = Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>;

/** Billing area of the back office (EPIC 13): shares the Billing messages (statuses...). */
export default async function BillingAdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ Admin: messages.Admin, Billing: messages.Billing }}>
      <div className="flex flex-col gap-8">
        <Suspense fallback={<BillingAdminNavView pathname={null} />}>
          <BillingAdminNav />
        </Suspense>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
