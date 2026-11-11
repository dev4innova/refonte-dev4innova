import { ArrowRight, Images } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { ContentGridSkeleton } from "@/components/cms/content-grid";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { accessStatus, adminApi, DOCUMENT_TYPES, requireSession } from "@/lib/admin";
import { redirectToLogin } from "@/lib/auth/redirect";

type Props = { params: Promise<{ locale: Locale }> };

/** Back-office dashboard (TASK-060). */
export default function AdminPage({ params }: Props) {
  return (
    <Suspense fallback={<ContentGridSkeleton count={5} />}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: Props) {
  const { locale } = await params;
  const returnTo = getPathname({ locale, href: "/admin" });
  const session = await requireSession(returnTo);
  const api = adminApi(session);
  const [t, ...lists] = await Promise.all([
    getTranslations({ locale, namespace: "Admin" }),
    ...DOCUMENT_TYPES.map((type) =>
      api.GET("/api/v1/admin/cms/documents", { params: { query: { type } } }).catch(() => null),
    ),
  ]);

  const status = lists[0] ? accessStatus(lists[0].response.status) : "unavailable";
  if (status === "signin") redirectToLogin(returnTo);
  if (status !== "ok") return <AdminNotice locale={locale} kind={status} />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_TYPES.map((type, index) => {
          const items = lists[index]?.data ?? [];
          const published = items.filter((i) => i.status === "published").length;
          return (
            <li key={type} className="flex">
              <Card interactive className="relative w-full">
                <CardHeader>
                  <CardTitle as="h2">
                    <Link
                      href={{ pathname: "/admin/content/[type]", params: { type } }}
                      className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
                    >
                      {t(`types.${type}`)}
                    </Link>
                  </CardTitle>
                  <CardDescription>{t(`typeDescriptions.${type}`)}</CardDescription>
                </CardHeader>
                <p className="flex items-center justify-between text-sm">
                  <span>
                    {published} {t("status.published").toLowerCase()} · {items.length - published}{" "}
                    {t("status.draft").toLowerCase()}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 text-primary-ink" />
                </p>
              </Card>
            </li>
          );
        })}
        <li className="flex">
          <Card interactive className="relative w-full">
            <CardHeader>
              <Images aria-hidden="true" className="size-6 text-primary-ink" />
              <CardTitle as="h2">
                <Link
                  href="/admin/media"
                  className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
                >
                  {t("nav.media")}
                </Link>
              </CardTitle>
              <CardDescription>{t("mediaDescription")}</CardDescription>
            </CardHeader>
          </Card>
        </li>
      </ul>
    </div>
  );
}
