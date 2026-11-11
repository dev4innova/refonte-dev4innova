import { ArrowRight, GraduationCap, Lock, ScrollText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type * as React from "react";
import { Suspense } from "react";

import { ContentGrid } from "@/components/cms/content-grid";
import { ServicesList, ServicesListSkeleton } from "@/components/cms/services-list";
import { RadarChart } from "@/components/diagnostic/radar-chart";
import { IllustrationPanel } from "@/components/illustrations/illustration";
import { illustrationLabels } from "@/components/illustrations/labels";
import {
  CertificateIllustration,
  DiagnosticReportIllustration,
  PortalIllustration,
  ValueIcon,
} from "@/components/illustrations/products";
import { SignalToSystem } from "@/components/illustrations/signal-to-system";
import { AssistantsIllustration, SolutionIllustration } from "@/components/illustrations/solutions";
import { AcademyPath, LabBoard } from "@/components/illustrations/worlds";
import { Section } from "@/components/layout/section";
import { BentoCell, BentoGrid } from "@/components/studio/bento-grid";
import { Eyebrow } from "@/components/studio/eyebrow";
import { MethodLoop, MethodTimeline } from "@/components/studio/method-timeline";
import { Reveal } from "@/components/studio/reveal";
import { RouteCard } from "@/components/studio/route-card";
import { SectionHeading } from "@/components/studio/section-heading";
import { Button } from "@/components/ui/button";
import { SOLUTIONS } from "@/config/offer";
import { pageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getContentList } from "@/lib/cms";
import { getSiteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ locale: Locale }> };

const VALUE = ["strategy", "build", "run"] as const;
const AXES = ["strategy", "data", "technology", "skills", "governance"] as const;
/* Illustrative values of the example radar (captioned as such, never client data). */
const EXAMPLE_SCORES = [72, 48, 60, 41, 55];
const METHOD = ["discover", "prototype", "industrialize", "scale"] as const;
const COMMITMENTS = [
  { key: "hosting", icon: ShieldCheck },
  { key: "data", icon: Lock },
  { key: "transparency", icon: ScrollText },
  { key: "skills", icon: GraduationCap },
] as const;
/* Bento of the solutions (doc 04 § 3.3): sizes in the order of SOLUTIONS. */
const BENTO = [
  { size: "lg", surface: "card" },
  { size: "md", surface: "card" },
  { size: "md", surface: "card" },
  { size: "lg", surface: "card" },
  { size: "wide", surface: "inverse" },
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return pageMetadata({ locale, href: "/", description: t("metaDescription") });
}

/** Corporate homepage, Creative Tech Studio redesign (doc 04): reading order = DOM order. */
export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tSolutions, tCommon, tMeta, tIllu] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Solutions"),
    getTranslations("Common"),
    getTranslations("Metadata"),
    getTranslations("Illustrations"),
  ]);
  const illu = illustrationLabels(tIllu);
  const siteUrl = getSiteUrl();

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: tMeta("siteName"),
      description: t("metaDescription"),
      url: siteUrl,
      logo: `${siteUrl}/brand/dev4innova-mark.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: tMeta("siteName"),
      url: `${siteUrl}/${locale}`,
      inLanguage: locale,
    },
  ];

  // The h1 text is unchanged; the word "IA" / "AI" takes the signature red.
  const title = t("title");
  const signal = t("titleSignal");
  const signalAt = title.lastIndexOf(signal);

  return (
    <>
      <script
        type="application/ld+json"
        // JSON built from our own constants and messages: no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      {/* 1. Hero: graphite, the header turns graphite over it (data-header-overlay). */}
      <Section
        variant="inverse"
        data-header-overlay=""
        aria-labelledby="home-title"
        className="pattern-blueprint relative overflow-hidden"
      >
        <div className="grid items-center gap-12 lg:grid-cols-[7fr_5fr] lg:gap-8">
          <div className="flex flex-col gap-7">
            <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
            <h1 id="home-title" className="text-display-2xl font-bold">
              {signalAt >= 0 ? (
                <>
                  {title.slice(0, signalAt)}
                  <span className="text-primary">{signal}</span>
                  {title.slice(signalAt + signal.length)}
                </>
              ) : (
                title
              )}
            </h1>
            <p className="max-w-2xl text-body-lg text-inverse-muted-foreground">{t("lead")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/contact">
                  {t("hero.primaryCta")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-inverse-muted-foreground text-inverse-foreground hover:border-inverse-foreground hover:text-inverse-foreground"
              >
                <Link href="/diagnostic">{t("hero.secondaryCta")}</Link>
              </Button>
            </div>
            <ul
              aria-label={t("hero.domainsLabel")}
              className="flex list-none flex-wrap gap-x-5 gap-y-2 p-0 font-heading text-sm text-inverse-muted-foreground"
            >
              {(["consulting", "development", "integration", "training"] as const).map((domain) => (
                <li key={domain} className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-1 rounded-full bg-primary-on-inverse" />
                  {t(`hero.domains.${domain}`)}
                </li>
              ))}
            </ul>
          </div>
          <SignalToSystem labels={illu.signalToSystem} className="mx-auto w-full max-w-lg" />
        </div>
      </Section>

      {/* 2. Value proposition: three commitments (frame, build, run). */}
      <Section aria-labelledby="home-value">
        <SectionHeading
          id="home-value"
          index="01"
          eyebrow={t("value.eyebrow")}
          title={t("value.title")}
          lead={t("value.lead")}
        />
        <Reveal>
          <ul className="grid list-none gap-px overflow-hidden rounded-frame border border-border bg-border p-0 md:grid-cols-3">
            {VALUE.map((key, index) => (
              <li key={key} className="flex flex-col gap-4 bg-card p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <ValueIcon name={key} className="size-11 text-foreground" />
                  <span aria-hidden="true" className="font-heading font-numeric text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-heading text-heading-lg font-semibold">{t(`value.${key}.title`)}</h3>
                <p className="text-muted-foreground">{t(`value.${key}.text`)}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </Section>

      {/* 3. AI diagnostic preview: the only public interactive experience. */}
      <Section spacing="tight" className="pt-0!" aria-labelledby="home-diagnostic">
        <Reveal>
          <div
            data-variant="inverse"
            className="theme-inverse grid items-center gap-10 rounded-frame bg-inverse p-6 text-inverse-foreground sm:p-10 lg:grid-cols-[7fr_5fr] lg:p-14"
          >
            <div className="flex flex-col items-start gap-5">
              <Eyebrow index="02">{t("diagnostic.eyebrow")}</Eyebrow>
              <h2 id="home-diagnostic" className="text-display-md font-semibold sm:text-display-lg">
                {t("diagnostic.title")}
              </h2>
              <p className="text-body-lg text-inverse-muted-foreground">{t("diagnostic.text")}</p>
              <ul aria-label={t("diagnostic.axesLabel")} className="flex list-none flex-wrap gap-2 p-0">
                {AXES.map((axis) => (
                  <li
                    key={axis}
                    className="rounded-full border border-inverse-border px-3 py-1 text-sm text-inverse-foreground"
                  >
                    {t(`diagnostic.axes.${axis}`)}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-2">
                <Link href="/diagnostic">
                  {t("diagnostic.cta")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <figure className="flex flex-col items-center gap-3">
              <RadarChart
                axes={AXES.map((axis, index) => ({
                  id: axis,
                  label: t(`diagnostic.axes.${axis}`),
                  score: EXAMPLE_SCORES[index] ?? 0,
                }))}
              />
              <figcaption className="text-center text-sm text-inverse-muted-foreground">
                {t("diagnostic.example")}
              </figcaption>
            </figure>
          </div>
        </Reveal>
      </Section>

      {/* 4. Solutions: Bento grid, one illustration per solution. */}
      <Section variant="tint" aria-labelledby="home-solutions">
        <SectionHeading
          id="home-solutions"
          index="03"
          eyebrow={t("solutions.eyebrow")}
          title={t("solutions.title")}
          lead={t("solutions.lead")}
          actions={
            <Button asChild variant="signal-link">
              <Link href="/solutions">
                {tCommon("allSolutions")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        <BentoGrid>
          {SOLUTIONS.map(({ slug }, index) => {
            const cell = BENTO[index] ?? BENTO[1];
            const wide = cell.size === "wide";
            return (
              <BentoCell
                key={slug}
                size={cell.size}
                surface={cell.surface}
                className={wide ? "lg:grid lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-10" : undefined}
              >
                <IllustrationPanel className={wide ? "lg:order-2" : undefined}>
                  <SolutionIllustration slug={slug} labels={illu.solutions} />
                </IllustrationPanel>
                <div className="flex flex-col gap-3">
                  <h3 className="font-heading text-heading-lg font-semibold">
                    <Link href={{ pathname: "/solutions/[slug]", params: { slug } }} data-stretched>
                      {tSolutions(`items.${slug}.title`)}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground in-data-[variant=inverse]:text-inverse-muted-foreground">
                    {tSolutions(`items.${slug}.summary`)}
                  </p>
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-ink in-data-[variant=inverse]:text-primary-on-inverse"
                  >
                    {tCommon("learnMore")}
                    <ArrowRight className="size-4 transition-transform duration-base ease-out-soft group-hover/cell:translate-x-1" />
                  </span>
                </div>
              </BentoCell>
            );
          })}
        </BentoGrid>
      </Section>

      {/* 5. Our work: products built by DEV4INNOVA, then client projects if published. */}
      <Section variant="inverse" aria-labelledby="home-work">
        <SectionHeading
          id="home-work"
          index="04"
          eyebrow={t("work.eyebrow")}
          title={t("work.title")}
          lead={t("work.lead")}
        />
        <ul className="grid list-none gap-bento p-0 md:grid-cols-2">
          <WorkItem
            title={t("work.products.diagnostic.title")}
            text={t("work.products.diagnostic.text")}
            link={{ href: "/diagnostic", label: t("work.products.diagnostic.link") }}
          >
            <DiagnosticReportIllustration labels={illu.products.diagnostic} />
          </WorkItem>
          <WorkItem
            title={t("work.products.aiTools.title")}
            text={t("work.products.aiTools.text")}
            link={{ href: "/contact", label: t("work.contact") }}
          >
            <AssistantsIllustration labels={illu.solutions["ai-assistants"]} />
          </WorkItem>
          <WorkItem
            title={t("work.products.portal.title")}
            text={t("work.products.portal.text")}
            link={{ href: "/contact", label: t("work.contact") }}
          >
            <PortalIllustration labels={illu.products.portal} />
          </WorkItem>
          <WorkItem
            title={t("work.products.academy.title")}
            text={t("work.products.academy.text")}
            link={{ href: "/academy", label: t("work.products.academy.link") }}
          >
            <CertificateIllustration labels={illu.products.certificate} />
          </WorkItem>
        </ul>
        <Suspense fallback={null}>
          <ClientProjects locale={locale} title={t("work.projectsTitle")} />
        </Suspense>
      </Section>

      {/* 6. Services: editorial list from the CMS. */}
      <Section aria-labelledby="home-services">
        <SectionHeading
          id="home-services"
          index="05"
          eyebrow={t("services.eyebrow")}
          title={t("services.title")}
          lead={t("services.lead")}
          actions={
            <Button asChild variant="signal-link">
              <Link href="/services">
                {tCommon("allServices")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        <Suspense fallback={<ServicesListSkeleton />}>
          <ServicesList
            locale={locale}
            empty={
              <p className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-6 text-muted-foreground">
                {t("services.empty")}
                <Button asChild variant="signal-link">
                  <Link href="/contact">
                    {tCommon("contactUs")}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </p>
            }
          />
        </Suspense>
      </Section>

      {/* 7. Method: four steps on a loop. */}
      <Section rule aria-labelledby="home-method">
        <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-16">
          <div className="flex flex-col gap-5">
            <Eyebrow index="06">{t("approach.eyebrow")}</Eyebrow>
            <h2 id="home-method" className="text-display-md font-semibold sm:text-display-lg">
              {t("approach.title")}
            </h2>
            <p className="text-body-lg text-muted-foreground">{t("approach.lead")}</p>
            <MethodLoop className="mt-2 hidden sm:block" />
          </div>
          <Reveal>
            <MethodTimeline
              steps={METHOD.map((key) => ({
                key,
                title: t(`approach.${key}.title`),
                text: t(`approach.${key}.text`),
                deliverable: t(`approach.${key}.deliverable`),
              }))}
            />
          </Reveal>
        </div>
      </Section>

      {/* 8. Commitments: four short, verifiable facts. */}
      <Section spacing="tight" className="pt-0!" aria-labelledby="home-commitments">
        <Eyebrow as="h2" id="home-commitments" index="07" className="mb-6">
          {t("commitments.title")}
        </Eyebrow>
        <ul className="grid list-none gap-px border-y border-border bg-border p-0 sm:grid-cols-2 lg:grid-cols-4">
          {COMMITMENTS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex flex-col gap-2 bg-background py-6 sm:px-6 lg:first:pl-0">
              <Icon aria-hidden="true" className="size-6 text-foreground" strokeWidth={1.5} />
              <h3 className="font-heading text-heading-sm font-semibold">{t(`commitments.${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`commitments.${key}.text`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 9. Innovation Lab and Academy: two distinct worlds. */}
      <Section spacing="tight" className="pt-0!" aria-labelledby="home-lab home-academy">
        <div className="grid gap-bento lg:grid-cols-2">
          <World
            id="home-lab"
            index="08"
            href="/innovation-lab"
            eyebrow={t("lab.eyebrow")}
            title={t("lab.title")}
            text={t("lab.text")}
            dark
          >
            <LabBoard labels={illu.lab} />
          </World>
          <World
            id="home-academy"
            index="09"
            href="/academy"
            eyebrow={t("academy.eyebrow")}
            title={t("academy.title")}
            text={t("academy.text")}
          >
            <AcademyPath labels={illu.academy} />
          </World>
        </div>
      </Section>

      <Suspense fallback={null}>
        <LatestInsights locale={locale} />
      </Suspense>

      {/* 10. Contact: two routes (the footer does not repeat them on this page). */}
      <Section variant="inverse" data-home-contact="" aria-labelledby="home-contact">
        <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-16">
          <div className="flex flex-col gap-5">
            <Eyebrow index="10">{t("contact.eyebrow")}</Eyebrow>
            <h2 id="home-contact" className="text-display-md font-semibold sm:text-display-lg">
              {t("contact.title")}
            </h2>
            <p className="text-body-lg text-inverse-muted-foreground">{t("contact.text")}</p>
          </div>
          <div className="flex flex-col gap-5">
            <div className="grid gap-bento sm:grid-cols-2">
              <ContactRoute routeKey="contact" href="/contact" />
              <ContactRoute routeKey="diagnostic" href="/diagnostic" />
            </div>
            <p className="flex flex-wrap items-center gap-x-3 text-sm text-inverse-muted-foreground">
              {t("contact.quote")}
              <Button asChild variant="signal-link">
                <Link href="/quote">
                  {t("contact.quoteLink")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

/** A product built by DEV4INNOVA: schematic visual (real screenshots in batch L6), text, link. */
function WorkItem({
  title,
  text,
  link,
  children,
}: {
  title: string;
  text: string;
  link: { href: "/diagnostic" | "/contact" | "/academy"; label: string };
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-frame border border-inverse-border bg-inverse-elevated p-5 sm:p-6">
      <IllustrationPanel>{children}</IllustrationPanel>
      <h3 className="font-heading text-heading-lg font-semibold">{title}</h3>
      <p className="text-inverse-muted-foreground">{text}</p>
      <Button asChild variant="signal-link" className="mt-auto self-start">
        <Link href={link.href}>
          {link.label}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

/** Innovation Lab or Academy card: the title is the link, the whole card is clickable. */
function World({
  id,
  index,
  href,
  eyebrow,
  title,
  text,
  dark = false,
  children,
}: {
  id: string;
  index: string;
  href: "/innovation-lab" | "/academy";
  eyebrow: string;
  title: string;
  text: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      data-variant={dark ? "inverse" : undefined}
      className={
        dark
          ? "group/world relative flex flex-col gap-4 rounded-frame bg-inverse p-6 text-inverse-foreground sm:p-8 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary-on-inverse"
          : "group/world relative flex flex-col gap-4 rounded-frame bg-tint p-6 text-tint-foreground sm:p-8 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring"
      }
    >
      <Eyebrow index={index}>{eyebrow}</Eyebrow>
      <h2 id={id} className="text-display-md font-semibold">
        <Link
          href={href}
          className="after:absolute after:inset-0 after:rounded-frame focus-visible:outline-none"
        >
          {title}
        </Link>
      </h2>
      <p className={dark ? "text-inverse-muted-foreground" : "text-muted-foreground"}>{text}</p>
      <IllustrationPanel className={dark ? "max-sm:aspect-square" : "bg-card/60"}>{children}</IllustrationPanel>
    </article>
  );
}

async function ContactRoute({
  routeKey,
  href,
}: {
  routeKey: "contact" | "diagnostic";
  href: "/contact" | "/diagnostic";
}) {
  const t = await getTranslations("Footer");
  return (
    <RouteCard
      href={href}
      title={t(`routes.${routeKey}.title`)}
      text={t(`routes.${routeKey}.text`)}
      action={t(`routes.${routeKey}.action`)}
    />
  );
}

/** Client projects published in the CMS, shown only when there are some. */
async function ClientProjects({ locale, title }: { locale: Locale; title: string }) {
  await connection();
  const projects = (await getContentList("project", locale)).slice(0, 3);
  if (projects.length === 0) return null;
  return (
    <div className="mt-14 flex flex-col gap-6">
      <h3 className="font-heading text-heading-lg font-semibold">{title}</h3>
      <ContentGrid
        items={projects.map((item) => ({
          key: item.id,
          title: item.title,
          summary: item.summary,
          cover: item.cover,
          meta: item.attributes.industry,
          href: { pathname: "/portfolio/[slug]", params: { slug: item.slug } },
        }))}
      />
    </div>
  );
}

/** Latest articles, only when at least two are published in the locale (no empty section). */
async function LatestInsights({ locale }: { locale: Locale }) {
  await connection();
  const articles = await getContentList("article", locale);
  if (articles.length < 2) return null;
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getFormatter({ locale }),
  ]);
  return (
    <Section variant="card" aria-labelledby="home-insights">
      <SectionHeading
        id="home-insights"
        eyebrow={t("insights.eyebrow")}
        title={t("insights.title")}
        actions={
          <Button asChild variant="signal-link">
            <Link href="/insights">
              {t("insights.all")}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <ContentGrid
        items={articles.slice(0, 3).map((item) => ({
          key: item.id,
          title: item.title,
          summary: item.summary,
          cover: item.cover,
          meta: item.published_at
            ? format.dateTime(new Date(item.published_at), { dateStyle: "long" })
            : undefined,
          href: { pathname: "/insights/[slug]", params: { slug: item.slug } },
        }))}
      />
    </Section>
  );
}
