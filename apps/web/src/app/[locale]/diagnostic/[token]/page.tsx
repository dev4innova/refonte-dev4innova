import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AiAnalysis } from "@/components/diagnostic/ai-analysis";
import { RadarChart } from "@/components/diagnostic/radar-chart";
import { UnlockForm } from "@/components/diagnostic/unlock-form";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { getContentList } from "@/lib/cms";
import { HORIZONS, type Recommendation } from "@/lib/diagnostic";
import { isToken } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Diagnostic" });
  // Personal result behind a secret link: never indexed, no referrer.
  return { title: t("result.metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** Result of a diagnostic: score, levels, priorities; the full report once unlocked. */
export default function DiagnosticResultPage({ params }: Props) {
  return (
    <Suspense fallback={<Section><div aria-hidden="true" className="h-[40rem] animate-pulse rounded-xl bg-muted" /></Section>}>
      <Result params={params} />
    </Suspense>
  );
}

async function Result({ params }: Props) {
  const { locale, token } = await params;
  if (!isToken(token)) notFound();
  const response = await serverApi()
    .GET("/api/v1/diagnostic/result", { params: { query: { token } } })
    .catch(() => null);
  if (response?.response.status === 404) notFound();
  const [t, format, services] = await Promise.all([
    getTranslations({ locale, namespace: "Diagnostic" }),
    getFormatter({ locale }),
    getContentList("service", locale),
  ]);
  const result = response?.data;
  if (!result) {
    return <Section><p role="alert" className="text-destructive">{t("errors.unavailable")}</p></Section>;
  }
  const serviceTitle = (slug: string) => services.find((s) => s.slug === slug)?.title;

  function RecommendationCard({ recommendation, showHorizon = true }: { recommendation: Recommendation; showHorizon?: boolean }) {
    const title = serviceTitle(recommendation.service);
    return (
      <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        {showHorizon ? (
          <p className="text-xs font-semibold tracking-wide text-primary-ink uppercase">{t(`horizons.${recommendation.horizon}`)}</p>
        ) : null}
        <h4 className="font-semibold">{recommendation.title}</h4>
        {recommendation.text ? <p className="text-muted-foreground">{recommendation.text}</p> : null}
        {title ? (
          <Link href={{ pathname: "/services/[slug]", params: { slug: recommendation.service } }} className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
            {t("result.service", { service: title })}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </li>
    );
  }

  return (
    <>
      <Section>
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary-ink uppercase">{t("eyebrow")}</p>
            <h1 className="text-display-lg font-semibold">{t("result.title")}</h1>
            <p className="text-muted-foreground">{t("result.date", { date: format.dateTime(new Date(result.created_at), { dateStyle: "long" }) })}</p>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <p className="flex items-baseline gap-2">
                <span className="font-heading text-[5rem] leading-none font-semibold text-primary-ink">{result.overall_score}</span>
                <span className="text-xl text-muted-foreground">/ 100</span>
              </p>
              <p className="text-heading-lg font-semibold">{t("result.level", { level: result.level_label })}</p>
              <p className="max-w-xl text-lg">{result.level_description}</p>
            </div>
            <div className="flex justify-center">
              <RadarChart axes={result.dimensions} />
            </div>
          </div>

          <section aria-labelledby="result-dimensions" className="flex flex-col gap-4">
            <h2 id="result-dimensions" className="text-heading-lg font-semibold">{t("result.dimensions")}</h2>
            <ul className="flex flex-col gap-3">
              {result.dimensions.map((dimension) => (
                <li key={dimension.id} className="grid items-center gap-2 sm:grid-cols-[16rem_minmax(0,1fr)_6rem]">
                  <span className="font-medium">{dimension.label}</span>
                  <span aria-hidden="true" className="block h-2.5 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${dimension.score}%` }} />
                  </span>
                  <span className="whitespace-nowrap tabular-nums sm:text-right">{t("result.score", { score: dimension.score })}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="result-priorities" className="flex flex-col gap-4">
            <h2 id="result-priorities" className="text-heading-lg font-semibold">{t("result.priorities")}</h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {result.priorities.map((priority) => (
                <RecommendationCard key={priority.id} recommendation={priority} />
              ))}
            </ol>
          </section>
        </div>
      </Section>

      {result.report ? (
        <Section variant="card">
          <div className="flex flex-col gap-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-display-md font-semibold">{t("report.title")}</h2>
              <Button asChild variant="secondary">
                <a href={`/api/diagnostic/${token}/report`} download>
                  <Download aria-hidden="true" />
                  {t("report.pdf")}
                </a>
              </Button>
            </div>
            <section aria-labelledby="report-analysis" className="flex flex-col gap-4 rounded-xl border border-border bg-background p-6">
              <h3 id="report-analysis" className="text-heading-lg font-semibold">{t("report.analysis")}</h3>
              <AiAnalysis token={token} status={result.report.ai_status} text={result.report.ai_analysis ?? null} />
            </section>
            {HORIZONS.map((horizon) => {
              const items = result.report!.recommendations.filter((r) => r.horizon === horizon);
              if (!items.length) return null;
              return (
                <section key={horizon} aria-labelledby={`report-${horizon}`} className="flex flex-col gap-4">
                  <h3 id={`report-${horizon}`} className="text-heading-lg font-semibold">{t(`horizonTitles.${horizon}`)}</h3>
                  <ul className="grid gap-4 md:grid-cols-2">
                    {items.map((r) => <RecommendationCard key={r.id} recommendation={r} showHorizon={false} />)}
                  </ul>
                </section>
              );
            })}
            <div className="flex flex-col items-start gap-3 rounded-xl bg-secondary p-6 text-secondary-foreground">
              <p className="text-heading-lg font-semibold">{t("report.ctaTitle")}</p>
              <p>{t("report.ctaText")}</p>
              <Button asChild variant="inverse">
                <Link href="/contact">{t("report.cta")}</Link>
              </Button>
            </div>
          </div>
        </Section>
      ) : (
        <Section variant="card">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-3">
              <h2 className="text-display-md font-semibold">{t("unlock.title")}</h2>
              <p className="text-lg text-muted-foreground">{t("unlock.text")}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>{t("unlock.points.a")}</li>
                <li>{t("unlock.points.b")}</li>
                <li>{t("unlock.points.c")}</li>
              </ul>
            </div>
            <UnlockForm token={token} />
          </div>
        </Section>
      )}
    </>
  );
}
