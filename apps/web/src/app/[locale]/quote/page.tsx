import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { Section } from "@/components/layout/section";
import { PageHeader } from "@/components/marketing/page-header";
import { QuoteForm, type QuoteFormLabels } from "@/components/quote/quote-form";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";
import { getContentList } from "@/lib/cms";
import { QUOTE_BUDGETS, QUOTE_TIMELINES } from "@/lib/quote/schema";

import { submitQuote } from "./actions";

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ service?: string | string[] }>;
};

const STEPS = ["a", "b", "c"] as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Quote" });
  return pageMetadata({
    locale,
    href: "/quote",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Quote request page (TASK-072): the request lands in the CRM as an opportunity. */
export default async function QuotePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Quote");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Suspense fallback={<div className="min-h-[40rem]" />}>
            <QuoteFormSection locale={locale} searchParams={searchParams} />
          </Suspense>
          <aside aria-labelledby="quote-next" className="flex flex-col gap-6">
            <h2 id="quote-next" className="text-heading-lg font-semibold">
              {t("asideTitle")}
            </h2>
            <ol className="flex flex-col gap-5">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-1">{t(`asideSteps.${step}`)}</span>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground">
              {t("asideContact")}{" "}
              <Link href="/contact" className="font-medium text-primary-ink underline underline-offset-4">
                {t("asideContactLink")}
              </Link>
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}

async function QuoteFormSection({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: Props["searchParams"];
}) {
  // Request-time data first: the services are then read at request time (cached), never
  // at build time when the API may be unreachable.
  const { service } = await searchParams;
  const [services, t] = await Promise.all([
    getContentList("service", locale),
    getTranslations({ locale, namespace: "Quote" }),
  ]);
  const labels: QuoteFormLabels = {
    fields: {
      name: t("form.name"),
      email: t("form.email"),
      company: t("form.company"),
      phone: t("form.phone"),
      service: t("form.service"),
      need: t("form.need"),
      budget: t("form.budget"),
      timeline: t("form.timeline"),
      consent: t("form.consent"),
    },
    needHelp: t("form.needHelp"),
    anyService: t("form.anyService"),
    privacyLink: t("form.privacyLink"),
    required: t("form.required"),
    optional: t("form.optional"),
    submit: t("form.submit"),
    sending: t("form.sending"),
    honeypot: t("form.honeypot"),
    budgets: Object.fromEntries(QUOTE_BUDGETS.map((b) => [b, t(`budgets.${b}`)])) as QuoteFormLabels["budgets"],
    timelines: Object.fromEntries(
      QUOTE_TIMELINES.map((v) => [v, t(`timelines.${v}`)]),
    ) as QuoteFormLabels["timelines"],
    success: { title: t("success.title"), text: t("success.text") },
    errors: {
      summary: t("errors.summary"),
      name: t("errors.name"),
      email: t("errors.email"),
      company: t("errors.company"),
      phone: t("errors.phone"),
      need: t("errors.need"),
      consent: t("errors.consent"),
      rateLimited: t("errors.rateLimited"),
      unavailable: t("errors.unavailable"),
    },
  };
  return (
    <QuoteForm
      action={submitQuote.bind(null, locale)}
      labels={labels}
      services={services.map((s) => ({ slug: s.slug, title: s.title }))}
      initialService={typeof service === "string" ? service : undefined}
    />
  );
}
