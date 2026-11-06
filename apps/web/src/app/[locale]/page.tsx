import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { ctaNavigation } from "@/config/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale, "/") };
}

// Placeholder hero until the corporate homepage (TASK-047).
export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <Section variant="inverse" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative flex max-w-3xl animate-slide-up flex-col gap-8">
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
  );
}
