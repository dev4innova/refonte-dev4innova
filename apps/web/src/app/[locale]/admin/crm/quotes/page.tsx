import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { CrmBadge } from "@/components/crm/crm-badge";
import { QuoteStatusSelect } from "@/components/crm/lead-controls";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { getContentList } from "@/lib/cms";
import { isOneOf, QUOTE_STATUSES } from "@/lib/crm";

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

/** Quote requests sent from the website (TASK-072). */
export default function QuotesPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Quotes {...props} />
    </Suspense>
  );
}

async function Quotes({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const statusParam = Array.isArray(query.status) ? query.status[0] : query.status;
  const status = isOneOf(QUOTE_STATUSES, statusParam) ? statusParam : undefined;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/crm/quotes" }), (api) =>
    api.GET("/api/v1/admin/crm/quote-requests", { params: { query: { status } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tQuote, format, services] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.crm" }),
    getTranslations({ locale, namespace: "Quote" }),
    getFormatter({ locale }),
    getContentList("service", locale),
  ]);
  const serviceTitle = (slug: string | null | undefined) =>
    slug ? (services.find((s) => s.slug === slug)?.title ?? slug) : tQuote("form.anyService");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display-md font-semibold">{t("quotes.title")}</h1>
      <nav aria-label={t("quotes.status")}>
        <ul className="flex flex-wrap gap-2 text-sm">
          {[undefined, ...QUOTE_STATUSES].map((value) => (
            <li key={value ?? "all"}>
              <Link
                href={{ pathname: "/admin/crm/quotes", query: value ? { status: value } : {} }}
                aria-current={status === value ? "true" : undefined}
                className="inline-flex h-9 items-center rounded-full border border-border px-3 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=true]:bg-secondary aria-[current=true]:text-secondary-foreground"
              >
                {value ? t(`quoteStatuses.${value}`) : t("quotes.all")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {loaded.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">
          {t("quotes.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {loaded.data.map((quote) => (
            <li key={quote.id} aria-labelledby={`quote-${quote.id}`} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 id={`quote-${quote.id}`} className="text-heading-sm font-semibold">
                    <Link
                      href={{ pathname: "/admin/crm/leads/[id]", params: { id: quote.lead.id } }}
                      className="underline-offset-4 hover:text-primary-ink hover:underline"
                    >
                      {quote.lead.company ? `${quote.lead.company} · ${quote.lead.name}` : quote.lead.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(new Date(quote.created_at), { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {quote.lead.email}
                  </p>
                </div>
                <div className="flex items-end gap-3">
                  <CrmBadge value={quote.status} label={t(`quoteStatuses.${quote.status}`)} />
                  <QuoteStatusSelect quoteId={quote.id} status={quote.status} />
                </div>
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">{t("quotes.service")}</dt><dd>{serviceTitle(quote.service)}</dd></div>
                <div><dt className="text-muted-foreground">{t("quotes.budget")}</dt><dd>{tQuote(`budgets.${quote.budget}`)}</dd></div>
                <div><dt className="text-muted-foreground">{t("quotes.timeline")}</dt><dd>{tQuote(`timelines.${quote.timeline}`)}</dd></div>
              </dl>
              <p className="line-clamp-4 whitespace-pre-line">{quote.need}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
