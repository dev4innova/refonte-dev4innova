import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OfferDetail } from "@/components/marketing/offer-detail";
import { isSolutionSlug, SOLUTIONS } from "@/config/offer";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

const LETTERS = ["a", "b", "c"] as const;

export function generateStaticParams() {
  return SOLUTIONS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSolutionSlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: "Solutions" });
  return pageMetadata({
    locale,
    href: { pathname: "/solutions/[slug]", params: { slug } },
    title: t(`items.${slug}.title`),
    description: t(`items.${slug}.summary`),
  });
}

/** Solution detail (TASK-049). */
export default async function SolutionPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isSolutionSlug(slug)) notFound();
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([getTranslations("Solutions"), getTranslations("Common")]);
  const solution = SOLUTIONS.find((s) => s.slug === slug)!;
  const title = t(`items.${slug}.title`);

  return (
    <OfferDetail
      icon={solution.icon}
      eyebrow={t("eyebrow")}
      title={title}
      summary={t(`items.${slug}.summary`)}
      description={t(`items.${slug}.description`)}
      breadcrumb={{
        label: tCommon("breadcrumb"),
        items: [
          { label: tCommon("home"), href: "/" },
          { label: t("eyebrow"), href: "/solutions" },
          { label: title },
        ],
      }}
      lists={[
        { title: t("benefits"), items: LETTERS.map((l) => t(`items.${slug}.benefits.${l}`)) },
        { title: t("useCases"), items: LETTERS.map((l) => t(`items.${slug}.useCases.${l}`)) },
      ]}
      related={{
        title: tCommon("allSolutions"),
        linkLabel: tCommon("learnMore"),
        items: SOLUTIONS.filter((s) => s.slug !== slug).map(({ slug: other, icon }) => ({
          key: other,
          icon,
          title: t(`items.${other}.title`),
          summary: t(`items.${other}.summary`),
          href: { pathname: "/solutions/[slug]", params: { slug: other } },
        })),
      }}
      cta={{ title: t("ctaTitle"), text: t("ctaText"), actionLabel: tCommon("contactUs") }}
    />
  );
}
