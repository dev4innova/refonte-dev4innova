import { ArrowRight, FlaskConical, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ContentGridSkeleton } from "@/components/cms/content-grid";
import { ServicesGrid } from "@/components/cms/services-grid";
import { Section } from "@/components/layout/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { OfferGrid } from "@/components/marketing/offer-grid";
import { Steps } from "@/components/marketing/steps";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ctaNavigation } from "@/config/navigation";
import { SOLUTIONS } from "@/config/offer";
import { pageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ locale: Locale }> };

const PILLARS = ["strategy", "build", "run"] as const;
const STEPS = ["discover", "prototype", "industrialize", "scale"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return pageMetadata({ locale, href: "/", description: t("metaDescription") });
}

/** Corporate homepage (TASK-047). */
export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tSolutions, tCommon, tMeta] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Solutions"),
    getTranslations("Common"),
    getTranslations("Metadata"),
  ]);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: tMeta("siteName"),
    description: t("metaDescription"),
    url: getSiteUrl(),
    logo: `${getSiteUrl()}/brand/dev4innova-mark.svg`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON built from our own constants and messages: no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }}
      />

      <Section variant="inverse" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative flex max-w-3xl animate-slide-up flex-col gap-8 py-6 md:py-12">
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary-on-inverse uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-display-xl font-bold">{t("title")}</h1>
          <p className="max-w-2xl text-lg text-inverse-muted-foreground">{t("lead")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={ctaNavigation.href}>
                {t("primaryCta")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="inverse">
              <Link href="/solutions">{t("secondaryCta")}</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section variant="card" aria-labelledby="home-pillars">
        <div className="mb-12 flex max-w-2xl flex-col gap-4">
          <h2 id="home-pillars" className="text-display-md font-semibold">
            {t("pillars.title")}
          </h2>
          <p className="text-lg text-muted-foreground">{t("pillars.lead")}</p>
        </div>
        <ul className="grid gap-8 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <li key={pillar} className="flex flex-col gap-3">
              <h3 className="text-heading-lg font-semibold">{t(`pillars.${pillar}.title`)}</h3>
              <p className="text-muted-foreground">{t(`pillars.${pillar}.text`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="home-solutions">
        <SectionIntro id="home-solutions" title={t("solutions.title")} lead={t("solutions.lead")}>
          <Button asChild variant="outline">
            <Link href="/solutions">{tCommon("allSolutions")}</Link>
          </Button>
        </SectionIntro>
        <OfferGrid
          linkLabel={tCommon("learnMore")}
          items={SOLUTIONS.map(({ slug, icon }) => ({
            key: slug,
            icon,
            title: tSolutions(`items.${slug}.title`),
            summary: tSolutions(`items.${slug}.summary`),
            href: { pathname: "/solutions/[slug]", params: { slug } },
          }))}
        />
      </Section>

      <Section variant="card" aria-labelledby="home-services">
        <SectionIntro id="home-services" title={t("services.title")} lead={t("services.lead")}>
          <Button asChild variant="outline">
            <Link href="/services">{tCommon("allServices")}</Link>
          </Button>
        </SectionIntro>
        <Suspense fallback={<ContentGridSkeleton />}>
          <ServicesGrid locale={locale} linkLabel={tCommon("learnMore")} />
        </Suspense>
      </Section>

      <Section aria-labelledby="home-diagnostic">
        <div className="flex flex-col items-start gap-6 rounded-2xl border border-border bg-card p-8 shadow-card md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary uppercase">{t("diagnostic.eyebrow")}</p>
            <h2 id="home-diagnostic" className="text-display-md font-semibold">{t("diagnostic.title")}</h2>
            <p className="text-lg text-muted-foreground">{t("diagnostic.text")}</p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/diagnostic">
              {t("diagnostic.cta")}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Section>

      <Section aria-labelledby="home-approach">
        <SectionIntro id="home-approach" title={t("approach.title")} lead={t("approach.lead")} />
        <Steps
          steps={STEPS.map((step) => ({
            key: step,
            title: t(`approach.${step}.title`),
            text: t(`approach.${step}.text`),
          }))}
        />
      </Section>

      <Section variant="card">
        <div className="grid gap-6 md:grid-cols-2">
          {(
            [
              { key: "lab", href: "/innovation-lab", icon: FlaskConical },
              { key: "academy", href: "/academy", icon: GraduationCap },
            ] as const
          ).map(({ key, href, icon: Icon }) => (
            <Card key={key} variant="elevated" interactive className="relative">
              <CardHeader>
                <Icon aria-hidden="true" className="size-8 text-primary" />
                <CardTitle as="h2">
                  <Link
                    href={href}
                    className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
                  >
                    {t(`${key}.title`)}
                  </Link>
                </CardTitle>
                <CardDescription className="text-base">{t(`${key}.text`)}</CardDescription>
              </CardHeader>
              <CardFooter>
                <span aria-hidden="true" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {tCommon("discover")}
                  <ArrowRight className="size-4" />
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Section>

      <CtaBand
        title={t("finalCta.title")}
        text={t("finalCta.text")}
        actionLabel={tCommon("contactUs")}
      />
    </>
  );
}

function SectionIntro({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-4">
        <h2 id={id} className="text-display-md font-semibold">
          {title}
        </h2>
        {lead ? <p className="text-lg text-muted-foreground">{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}
