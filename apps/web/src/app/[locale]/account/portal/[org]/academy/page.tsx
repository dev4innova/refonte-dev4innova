import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PortalHeader } from "@/components/portal/portal-header";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { portalContext } from "@/lib/portal-server";

type Props = { params: Promise<{ locale: Locale; org: string }> };

/** Progress of the members DEV4INNOVA enrolled for the organization (owners and admins). */
export default function SponsoredCoursesPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <SponsoredCourses params={params} />
    </Suspense>
  );
}

async function SponsoredCourses({ params }: Props) {
  const { locale, org } = await params;
  const { membership, api } = await portalContext(locale, { pathname: "/account/portal/[org]/academy", params: { org } }, org);
  const [t, tPortal, format, rows] = await Promise.all([
    getTranslations({ locale, namespace: "Academy" }),
    getTranslations({ locale, namespace: "Portal" }),
    getFormatter({ locale }),
    api
      .GET("/api/v1/organizations/{organization_id}/academy/enrollments", { params: { path: { organization_id: org }, query: { locale } } })
      .then((r) => (r.response.ok ? r.data : null))
      .catch(() => undefined),
  ]);
  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} role={membership.role} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("sponsored.title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("sponsored.lead")}</p>
      </div>
      {rows === null ? (
        <p role="alert" className="text-destructive">{tPortal("errors.forbidden")}</p>
      ) : !rows ? (
        <p role="alert" className="text-destructive">{tPortal("errors.load")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-8 text-center text-muted-foreground">{t("sponsored.empty")}</p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">{t("sponsored.title")}</caption>
            <thead className="border-b border-border text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="p-3">{t("sponsored.learner")}</th>
                <th scope="col" className="p-3">{t("sponsored.course")}</th>
                <th scope="col" className="p-3">{t("sponsored.progress")}</th>
                <th scope="col" className="p-3">{t("sponsored.lastActivity")}</th>
                <th scope="col" className="p-3">{t("sponsored.certificate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="p-3 font-medium">{row.learner.display_name ?? row.learner.email}</th>
                  <td className="p-3">{row.course.title}</td>
                  <td className="p-3">{t("learner.progress", { percent: row.progress.percent })}</td>
                  <td className="p-3">{format.dateTime(new Date(row.last_activity_at), { dateStyle: "medium" })}</td>
                  <td className="p-3">
                    {row.certificate_code ? (
                      <Link
                        href={{ pathname: "/academy/certificate/[code]", params: { code: row.certificate_code } }}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {row.certificate_code}
                      </Link>
                    ) : (
                      t("sponsored.none")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
