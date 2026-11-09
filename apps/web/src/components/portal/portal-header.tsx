import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Link } from "@/i18n/navigation";

import { NotificationBell } from "./notification-bell";
import { PortalNav } from "./portal-nav";

/** Top of every page of an organization's portal: way back, organization, bell, sections. */
export async function PortalHeader({ org, organizationName, role }: { org: string; organizationName: string; role: string }) {
  const [t, tAcademy] = await Promise.all([getTranslations("Portal"), getTranslations("Academy.sponsored")]);
  const academyLabel = tAcademy("nav");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link href="/account" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("back")}
          </Link>
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary uppercase">{organizationName}</p>
        </div>
        <Suspense fallback={<span aria-hidden="true" className="size-11 rounded-full border border-border" />}>
          <NotificationBell />
        </Suspense>
      </div>
      <PortalNav org={org} academy={role === "owner" || role === "admin"} academyLabel={academyLabel} />
    </div>
  );
}
