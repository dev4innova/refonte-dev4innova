import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { InvoiceList } from "@/components/billing/document-lists";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ open?: string }> };

/** Invoices and credit notes of every client (TASK-112). */
export default function InvoicesAdminPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <InvoicesAdmin {...props} />
    </Suspense>
  );
}

async function InvoicesAdmin({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const open = query.open === "1";
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/billing/invoices" }), (api) =>
    api.GET("/api/v1/admin/billing/invoices", { params: { query: { open_only: open } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const t = await getTranslations({ locale, namespace: "Admin.billing.invoices" });
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display-md font-semibold">{t("title")}</h1>
      <nav aria-label={t("title")}>
        <ul className="flex gap-2 text-sm">
          {[false, true].map((value) => (
            <li key={String(value)}>
              <Link
                href={{ pathname: "/admin/billing/invoices", query: value ? { open: "1" } : {} }}
                aria-current={value === open ? "page" : undefined}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 font-medium hover:bg-muted aria-[current=page]:border-secondary aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
              >
                {value ? t("openOnly") : t("all")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <InvoiceList
        invoices={loaded.data.items}
        empty={t("empty")}
        showClient
        href={(i) => ({ pathname: "/admin/billing/invoices/[id]", params: { id: i.id } })}
        pdf={(i) => `/api/admin/billing/invoices/${i.id}`}
      />
    </div>
  );
}
