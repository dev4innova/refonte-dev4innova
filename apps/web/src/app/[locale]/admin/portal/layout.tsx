import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { PortalAdminNav, PortalAdminNavView } from "@/components/portal-admin/portal-admin-nav";
import type { Locale } from "@/i18n/routing";

type Props = Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>;

/** Client portal area of the back office (EPIC 11): shares the Portal messages (statuses...). */
export default async function PortalAdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ Admin: messages.Admin, Portal: messages.Portal }}>
      <div className="flex flex-col gap-8">
        <Suspense fallback={<PortalAdminNavView pathname={null} />}>
          <PortalAdminNav />
        </Suspense>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
