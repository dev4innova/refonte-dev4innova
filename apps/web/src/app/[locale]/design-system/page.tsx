import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
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
] as const;

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
  const t = await getTranslations("DesignSystem");

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
            className="rounded-frame bg-inverse bg-blueprint p-6 text-inverse-foreground"
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

      <Section variant="card" aria-labelledby="ds-buttons">
        <SectionTitle id="ds-buttons">{t("sections.buttons")}</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t("buttons.primary")}</Button>
          <Button variant="secondary">{t("buttons.secondary")}</Button>
          <Button variant="outline">{t("buttons.outline")}</Button>
          <Button variant="ghost">{t("buttons.ghost")}</Button>
          <Button variant="link">{t("buttons.link")}</Button>
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
        <div className="grid gap-6 md:grid-cols-3">
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
