import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { QuoteEditor } from "@/components/billing-admin/quote-editor";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }> };

/** A new draft quote (TASK-111). */
export default function NewQuotePage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <NewQuote params={params} />
    </Suspense>
  );
}

async function NewQuote({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/billing/quotes/new" }), async (api) => {
    const [organizations, products] = await Promise.all([api.GET("/api/v1/admin/billing/organizations"), api.GET("/api/v1/admin/billing/products")]);
    return { data: organizations.data && products.data ? { organizations: organizations.data, products: products.data } : undefined, response: organizations.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const t = await getTranslations({ locale, namespace: "Admin.billing.quotes" });
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/billing/quotes" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <h1 className="text-display-md font-semibold">{t("new")}</h1>
      <QuoteEditor organizations={loaded.data.organizations} products={loaded.data.products.filter((p) => p.active)} />
    </div>
  );
}
