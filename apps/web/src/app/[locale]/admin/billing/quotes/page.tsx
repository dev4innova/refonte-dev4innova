import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { QuoteList } from "@/components/billing/document-lists";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }> };

/** Quotes of every client (TASK-111). */
export default function QuotesAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <QuotesAdmin params={params} />
    </Suspense>
  );
}

async function QuotesAdmin({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/billing/quotes" }), (api) => api.GET("/api/v1/admin/billing/quotes"));
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const t = await getTranslations({ locale, namespace: "Admin.billing.quotes" });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/admin/billing/quotes/new">
            <Plus aria-hidden="true" />
            {t("new")}
          </Link>
        </Button>
      </div>
      <QuoteList quotes={loaded.data.items} empty={t("empty")} showClient href={(q) => ({ pathname: "/admin/billing/quotes/[id]", params: { id: q.id } })} />
    </div>
  );
}
