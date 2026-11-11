import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { IllustrationPanel } from "@/components/illustrations/illustration";
import { SignalToSystem, SignalToSystemCompact } from "@/components/illustrations/signal-to-system";
import { illustrationLabels } from "@/components/illustrations/labels";
import { SolutionIllustration } from "@/components/illustrations/solutions";
import { AcademyPath, LabBoard } from "@/components/illustrations/worlds";
import { Section } from "@/components/layout/section";
import { BentoCell, BentoGrid } from "@/components/studio/bento-grid";
import { Eyebrow } from "@/components/studio/eyebrow";
import { MethodLoop, MethodTimeline } from "@/components/studio/method-timeline";
import { Kbd, StatusDot, Tag } from "@/components/studio/micro";
import { ProductFrame } from "@/components/studio/product-frame";
import { Reveal } from "@/components/studio/reveal";
import { SectionHeading } from "@/components/studio/section-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SOLUTIONS } from "@/config/offer";
import { localeAlternates } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

const COLORS = [
  { token: "primary", key: "primary", className: "bg-primary" },
  { token: "primary-ink", key: "primaryInk", className: "bg-primary-ink" },
  { token: "secondary", key: "secondary", className: "bg-secondary" },
  { token: "background", key: "background", className: "bg-background" },
  { token: "card", key: "card", className: "bg-card" },
  { token: "muted", key: "muted", className: "bg-muted" },
  { token: "muted-foreground", key: "mutedForeground", className: "bg-muted-foreground" },
  { token: "input", key: "steel", className: "bg-input" },
  { token: "tint", key: "tint", className: "bg-tint" },
  { token: "accent", key: "accent", className: "bg-accent" },
  { token: "success", key: "success", className: "bg-success" },
  { token: "warning", key: "warning", className: "bg-warning" },
  { token: "inverse-elevated", key: "inverseElevated", className: "bg-inverse-elevated" },
  { token: "inverse-deep", key: "inverseDeep", className: "bg-inverse-deep" },
  { token: "primary-on-inverse", key: "primaryOnInverse", className: "bg-primary-on-inverse" },
] as const;

const TYPOGRAPHY = [
  { key: "eyebrow", className: "text-eyebrow font-semibold uppercase text-primary-ink" },
  { key: "display2xl", className: "font-heading text-display-2xl font-bold" },
  { key: "displayXl", className: "font-heading text-display-xl font-bold" },
  { key: "displayLg", className: "font-heading text-display-lg font-bold" },
  { key: "displayMd", className: "font-heading text-display-md font-semibold" },
  { key: "headingLg", className: "font-heading text-heading-lg font-semibold" },
  { key: "headingSm", className: "font-heading text-heading-sm font-semibold" },
  { key: "bodyLg", className: "text-body-lg" },
  { key: "body", className: "text-base" },
  { key: "bodySm", className: "text-sm text-muted-foreground" },
] as const;

const SPACING = [
  { label: "gutter", className: "w-gutter" },
  { label: "bento", className: "w-bento" },
  { label: "4", className: "w-4" },
  { label: "8", className: "w-8" },
  { label: "12", className: "w-12" },
  { label: "16", className: "w-16" },
  { label: "24", className: "w-24" },
] as const;

const CARDS = [
  { key: "strategy", variant: "default" },
  { key: "integration", variant: "elevated" },
  { key: "support", variant: "inverse" },
  { key: "frame", variant: "frame" },
] as const;

/* Bento sizes of the five solutions, as on the future homepage (doc 04). */
const BENTO = [
  { size: "lg", surface: "card" },
  { size: "md", surface: "tint" },
  { size: "md", surface: "card" },
  { size: "lg", surface: "card" },
  { size: "wide", surface: "inverse" },
] as const;

const METHOD = ["discover", "prototype", "industrialize", "scale"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    alternates: localeAlternates(locale, "/design-system"),
  };
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-8 text-display-md font-semibold">
      {children}
    </h2>
  );
}

/** Internal showcase of the design system (EPIC 02). */
export default async function DesignSystemPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tSolutions, tHome, tCommon, tIllu] = await Promise.all([
    getTranslations("DesignSystem"),
    getTranslations("Solutions"),
    getTranslations("Home"),
    getTranslations("Common"),
    getTranslations("Illustrations"),
  ]);
  const illu = illustrationLabels(tIllu);
  const solutionLabels = illu.solutions;

  return (
    <>
      <Section variant="card">
        <h1 className="text-display-lg font-bold">{t("title")}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t("lead")}</p>
      </Section>

      <Section aria-labelledby="ds-colors">
        <SectionTitle id="ds-colors">{t("sections.colors")}</SectionTitle>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {COLORS.map((color) => (
            <li key={color.token} className="overflow-hidden rounded-lg border bg-card">
              <div className={`h-20 border-b ${color.className}`} />
              <div className="p-3">
                <p className="text-sm font-medium">{t(`colors.${color.key}`)}</p>
                <p className="font-mono text-xs text-muted-foreground">--{color.token}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section variant="card" aria-labelledby="ds-typography">
        <SectionTitle id="ds-typography">{t("sections.typography")}</SectionTitle>
        <div className="flex flex-col gap-6">
          {TYPOGRAPHY.map((item) => (
            <p key={item.key} className={item.className}>
              {t(`typography.${item.key}`)}
            </p>
          ))}
        </div>
      </Section>

      <Section aria-labelledby="ds-spacing">
        <SectionTitle id="ds-spacing">{t("sections.spacing")}</SectionTitle>
        <ul className="flex flex-col gap-3">
          {SPACING.map((space) => (
            <li key={space.label} className="flex items-center gap-4">
              <span className="w-16 font-mono text-sm text-muted-foreground">{space.label}</span>
              <span className={`block h-4 rounded-sm bg-primary ${space.className}`} />
            </li>
          ))}
        </ul>
      </Section>

      <Section variant="tint" aria-labelledby="ds-surfaces">
        <SectionTitle id="ds-surfaces">{t("sections.surfaces")}</SectionTitle>
        <div className="grid gap-bento md:grid-cols-3">
          <div className="rounded-frame border border-hairline bg-card p-6 shadow-frame">
            <p className="font-heading text-heading-sm font-semibold">{t("surfaces.frame")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("surfaces.frameText")}</p>
          </div>
          <div
            data-variant="inverse"
            className="rounded-frame bg-inverse pattern-blueprint p-6 text-inverse-foreground"
          >
            <p className="font-heading text-heading-sm font-semibold">{t("surfaces.blueprint")}</p>
            <p className="mt-2 text-sm text-inverse-muted-foreground">{t("surfaces.blueprintText")}</p>
          </div>
          <div className="rounded-frame border border-hairline bg-tint-subtle p-6">
            <p className="font-heading text-heading-sm font-semibold">{t("surfaces.numeric")}</p>
            <p className="mt-2 font-numeric font-heading text-display-md font-bold">
              01 · 02 · 03 · 04
            </p>
          </div>
        </div>
      </Section>

      <Section aria-labelledby="ds-studio">
        <SectionHeading
          id="ds-studio"
          index="01"
          eyebrow={t("studio.eyebrow")}
          title={t("sections.studio")}
          lead={t("studio.lead")}
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
          {SOLUTIONS.map(({ slug, icon: Icon }, index) => {
            const cell = BENTO[index] ?? BENTO[0];
            return (
              <BentoCell
                key={slug}
                size={cell.size}
                surface={cell.surface}
                // Wide cell: text and illustration side by side from 1024 px.
                className={cell.size === "wide" ? "lg:grid lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-10" : undefined}
              >
                <IllustrationPanel className={cell.size === "wide" ? "lg:order-2" : undefined}>
                  <SolutionIllustration slug={slug} labels={solutionLabels} />
                </IllustrationPanel>
                <div className="flex flex-col gap-4">
                  <Icon
                    aria-hidden="true"
                    className="size-6 text-primary-ink in-data-[variant=inverse]:text-primary-on-inverse"
                  />
                  <h3 className="font-heading text-heading-lg font-semibold">
                    <Link
                      href={{ pathname: "/solutions/[slug]", params: { slug } }}
                      data-stretched
                    >
                      {tSolutions(`items.${slug}.title`)}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground in-data-[variant=inverse]:text-inverse-muted-foreground">
                    {tSolutions(`items.${slug}.summary`)}
                  </p>
                </div>
              </BentoCell>
            );
          })}
        </BentoGrid>
      </Section>

      <Section variant="inverse" spacing="tight" aria-labelledby="ds-frame">
        <div className="grid items-center gap-10 lg:grid-cols-[5fr_7fr]">
          <div className="flex flex-col gap-4">
            <Eyebrow index="02">{t("studio.frameEyebrow")}</Eyebrow>
            <h2 id="ds-frame" className="text-display-md font-semibold">
              {t("studio.frameHeading")}
            </h2>
            <p className="text-inverse-muted-foreground">{t("studio.frameText")}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <StatusDot status="live" />
              {t("studio.status")}
              <Tag>Next.js</Tag>
              <Tag>FastAPI</Tag>
            </p>
          </div>
          <ProductFrame
            title={t("studio.frameTitle")}
            demoLabel={t("studio.demo")}
            caption={t("studio.frameCaption")}
          >
            <div aria-hidden="true" className="flex size-full flex-col gap-3 p-6">
              <div className="h-4 w-1/3 rounded-sm bg-input/40" />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div className="col-span-2 rounded-md bg-card" />
                <div className="rounded-md bg-tint" />
              </div>
            </div>
          </ProductFrame>
        </div>
      </Section>

      <Section rule aria-labelledby="ds-method">
        <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-16">
          <div className="flex flex-col gap-4">
            <Eyebrow index="03">{t("studio.methodEyebrow")}</Eyebrow>
            <h2 id="ds-method" className="text-display-md font-semibold">
              {tHome("approach.title")}
            </h2>
            <p className="text-body-lg text-muted-foreground">{tHome("approach.lead")}</p>
            <MethodLoop className="mt-4" />
          </div>
          <MethodTimeline
            steps={METHOD.map((key) => ({
              key,
              title: tHome(`approach.${key}.title`),
              text: tHome(`approach.${key}.text`),
            }))}
          />
        </div>
      </Section>

      <Section variant="tint" spacing="tight" aria-labelledby="ds-reveal">
        <h2 id="ds-reveal" className="mb-6 text-heading-lg font-semibold">
          {t("studio.revealTitle")}
        </h2>
        <div className="grid gap-bento sm:grid-cols-3">
          {[0, 1, 2].map((step) => (
            <Reveal key={step} step={step} className="rounded-frame bg-card p-6 shadow-card">
              {t("studio.revealText", { step: step + 1 })}
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {t("studio.kbd")} <Kbd>{t("studio.kbdKey")}</Kbd>
        </p>
      </Section>

      <Section variant="card" aria-labelledby="ds-illustrations">
        <SectionHeading
          id="ds-illustrations"
          index="04"
          eyebrow={t("illustrations.eyebrow")}
          title={t("sections.illustrations")}
          lead={t("illustrations.lead")}
        />
        <ul className="grid list-none gap-bento p-0 md:grid-cols-2">
          {SOLUTIONS.map(({ slug }) => (
            <li key={slug} className="flex flex-col gap-3">
              <IllustrationPanel>
                <SolutionIllustration slug={slug} labels={solutionLabels} />
              </IllustrationPanel>
              <p className="text-sm text-muted-foreground">{tSolutions(`items.${slug}.title`)}</p>
            </li>
          ))}
          <li className="flex flex-col gap-3">
            <IllustrationPanel>
              <AcademyPath labels={illu.academy} />
            </IllustrationPanel>
            <p className="text-sm text-muted-foreground">{t("illustrations.academy")}</p>
          </li>
        </ul>
      </Section>

      <Section variant="inverse" className="pattern-blueprint" aria-labelledby="ds-illustrations-dark">
        <h2 id="ds-illustrations-dark" className="mb-10 text-display-md font-semibold">
          {t("illustrations.darkTitle")}
        </h2>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <figure className="flex flex-col gap-3">
            <SignalToSystem
              labels={illu.signalToSystem}
              className="mx-auto w-full max-w-lg"
            />
            <figcaption className="text-sm text-inverse-muted-foreground">
              {t("illustrations.signature")}
            </figcaption>
          </figure>
          <div className="flex flex-col gap-10">
            <figure className="flex flex-col gap-3">
              <IllustrationPanel className="max-sm:aspect-square">
                <LabBoard labels={illu.lab} />
              </IllustrationPanel>
              <figcaption className="text-sm text-inverse-muted-foreground">
                {t("illustrations.lab")}
              </figcaption>
            </figure>
            <figure className="flex flex-col gap-3">
              <div className="max-w-xs">
                <SignalToSystemCompact />
              </div>
              <figcaption className="text-sm text-inverse-muted-foreground">
                {t("illustrations.compact")}
              </figcaption>
            </figure>
            <figure className="flex flex-col gap-3">
              <IllustrationPanel>
                <SolutionIllustration slug="ai-integration" labels={solutionLabels} />
              </IllustrationPanel>
              <figcaption className="text-sm text-inverse-muted-foreground">
                {t("illustrations.inverse")}
              </figcaption>
            </figure>
          </div>
        </div>
      </Section>

      <Section variant="card" aria-labelledby="ds-buttons">
        <SectionTitle id="ds-buttons">{t("sections.buttons")}</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t("buttons.primary")}</Button>
          <Button variant="secondary">{t("buttons.secondary")}</Button>
          <Button variant="outline">{t("buttons.outline")}</Button>
          <Button variant="ghost">{t("buttons.ghost")}</Button>
          <Button variant="link">{t("buttons.link")}</Button>
          <Button variant="signal-link">
            {t("buttons.signalLink")}
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button loading>{t("buttons.loading")}</Button>
          <Button disabled>{t("buttons.disabled")}</Button>
          <Button size="icon" variant="outline" aria-label={t("buttons.icon")}>
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="sm">{t("buttons.primary")}</Button>
          <Button size="md">{t("buttons.primary")}</Button>
          <Button size="lg">{t("buttons.primary")}</Button>
        </div>
      </Section>

      <Section aria-labelledby="ds-cards">
        <SectionTitle id="ds-cards">{t("sections.cards")}</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card) => (
            <Card key={card.key} variant={card.variant} interactive>
              <CardHeader>
                <CardTitle>{t(`cards.${card.key}.title`)}</CardTitle>
                <CardDescription>{t(`cards.${card.key}.description`)}</CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Button asChild variant={card.variant === "inverse" ? "inverse" : "outline"} size="sm">
                  <Link href="/solutions">
                    {t(`cards.${card.key}.action`)}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Section>

      <Section variant="card" aria-labelledby="ds-forms">
        <SectionTitle id="ds-forms">{t("sections.forms")}</SectionTitle>
        <form className="grid max-w-2xl gap-6" action="#">
          <FormField label={t("form.name")} required requiredLabel={t("form.required")}>
            <Input name="name" autoComplete="name" />
          </FormField>
          <FormField
            label={t("form.email")}
            description={t("form.emailHelp")}
            error={t("form.emailError")}
          >
            <Input name="email" type="email" autoComplete="email" defaultValue="contact@" />
          </FormField>
          <FormField label={t("form.message")}>
            <Textarea name="message" />
          </FormField>
          <FormField label={t("form.consent")} inline>
            <Checkbox name="consent" />
          </FormField>
          <div>
            <Button type="submit">{t("form.submit")}</Button>
          </div>
        </form>
      </Section>

      <Section aria-labelledby="ds-motion">
        <SectionTitle id="ds-motion">{t("sections.motion")}</SectionTitle>
        <div className="flex flex-wrap gap-6">
          <div className="grid size-32 animate-fade-in place-items-center rounded-xl bg-card shadow-card">
            {t("motion.fade")}
          </div>
          <div className="grid size-32 animate-slide-up place-items-center rounded-xl bg-card shadow-card">
            {t("motion.slide")}
          </div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{t("motion.note")}</p>
      </Section>

      <Section variant="inverse" aria-labelledby="ds-inverse">
        <h2 id="ds-inverse" className="text-display-md font-semibold">
          {t("inverse.title")}
        </h2>
        <p className="mt-4 max-w-2xl text-inverse-muted-foreground">
          {t("inverse.text")}{" "}
          <Link
            href="/solutions"
            className="font-medium text-primary-on-inverse underline underline-offset-4"
          >
            {t("inverse.link")}
          </Link>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button>{t("inverse.action")}</Button>
          <Button variant="inverse">{t("inverse.secondary")}</Button>
        </div>
      </Section>
    </>
  );
}
