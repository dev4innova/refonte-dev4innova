import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { ProductForm } from "@/components/billing-admin/product-form";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { money, rateLabel } from "@/lib/billing";

type Props = { params: Promise<{ locale: Locale }> };

/** The catalog: services, subscriptions, paid courses (TASK-110). */
export default function ProductsAdminPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <ProductsAdmin params={params} />
    </Suspense>
  );
}

async function ProductsAdmin({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/billing/products" }), async (api) => {
    const [products, courses] = await Promise.all([api.GET("/api/v1/admin/billing/products"), api.GET("/api/v1/admin/academy/courses")]);
    // Course list: only staff who also manage the Academy see it (staff_admin).
    return { data: products.data ? { products: products.data, courses: courses.data ?? [] } : undefined, response: products.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tBilling] = await Promise.all([getTranslations({ locale, namespace: "Admin.billing.products" }), getTranslations({ locale, namespace: "Billing" })]);
  const courses = loaded.data.courses.map((c) => ({ id: c.id, title: c.title[locale] || c.title.fr || c.slug }));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("lead")}</p>
      </div>
      {loaded.data.products.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {loaded.data.products.map((p) => {
            const name = p.name[locale] || p.name.fr || p.code;
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold">{p.code} – {name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`kinds.${p.kind}`)} · {money(p.unit_price_cents, locale)} {tBilling("excludingVat")} · {tBilling("quote.vat")} {rateLabel(p.vat_rate_bp, locale)}
                      {p.interval ? <> · {tBilling(`interval.${p.interval}`)}</> : null}
                      {p.course_slug ? <> · /academy/{p.course_slug}</> : null}
                      {!p.active ? <> · {t("inactive")}</> : null}
                    </span>
                  </div>
                </div>
                <details className="rounded-lg border border-border p-3">
                  <summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Pencil aria-hidden="true" className="size-4" />
                    {t("edit", { name })}
                  </summary>
                  <div className="mt-3">
                    <ProductForm product={p} courses={courses} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <section aria-labelledby="product-new" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="product-new" className="text-heading-sm font-semibold">{t("new")}</h2>
        <ProductForm courses={courses} />
      </section>
    </div>
  );
}
