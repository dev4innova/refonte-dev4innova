import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { accessStatus, adminApi, isDocumentType, requireSession } from "@/lib/admin";
import { redirectToLogin } from "@/lib/auth/redirect";

type Props = { params: Promise<{ locale: Locale; type: string }> };

/** List of one content type (TASK-061 to TASK-064). */
export default function ContentListPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <ContentList params={params} />
    </Suspense>
  );
}

async function ContentList({ params }: Props) {
  const { locale, type } = await params;
  if (!isDocumentType(type)) notFound();
  const returnTo = getPathname({ locale, href: { pathname: "/admin/content/[type]", params: { type } } });
  const session = await requireSession(returnTo);
  const [t, format, result] = await Promise.all([
    getTranslations({ locale, namespace: "Admin" }),
    getFormatter({ locale }),
    adminApi(session)
      .GET("/api/v1/admin/cms/documents", { params: { query: { type } } })
      .catch(() => null),
  ]);

  const status = result ? accessStatus(result.response.status) : "unavailable";
  if (status === "signin") redirectToLogin(returnTo);
  if (status !== "ok" || !result?.data) return <AdminNotice locale={locale} kind={status === "ok" ? "unavailable" : status} />;
  const items = result.data;
  const other: Locale = locale === "fr" ? "en" : "fr";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-display-md font-semibold">{t(`types.${type}`)}</h1>
        <Button asChild>
          <Link href={{ pathname: "/admin/content/[type]/new", params: { type } }}>
            <Plus aria-hidden="true" />
            {t("list.new")}
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">
          {t("list.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("list.title")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("list.status")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("list.updated")}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t("list.edit")}</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const title = item.titles[locale] ?? item.titles[other] ?? "—";
                return (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {title}
                      {item.titles[locale] ? null : (
                        <span className="ml-2 text-xs text-muted-foreground">{t("list.missingTranslation")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} label={t(`status.${item.status}`)} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format.dateTime(new Date(item.updated_at), { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={{ pathname: "/admin/content/[type]/[id]", params: { type, id: item.id } }}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {t("list.edit")}
                        <span className="sr-only"> : {title}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
