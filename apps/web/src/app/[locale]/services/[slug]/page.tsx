import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OfferDetail } from "@/components/marketing/offer-detail";
import { isServiceSlug, SERVICES } from "@/config/offer";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

const LETTERS = ["a", "b", "c"] as const;

export function generateStaticParams() {
  return SERVICES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isServiceSlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: "Services" });
  return pageMetadata({
    locale,
    href: { pathname: "/services/[slug]", params: { slug } },
    title: t(`items.${slug}.title`),
    description: t(`items.${slug}.summary`),
  });
}

/** Service detail (TASK-050). */
export default async function ServicePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isServiceSlug(slug)) notFound();
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([getTranslations("Services"), getTranslations("Common")]);
  const service = SERVICES.find((s) => s.slug === slug)!;
  const title = t(`items.${slug}.title`);

  return (
    <OfferDetail
      icon={service.icon}
      eyebrow={t("eyebrow")}
      title={title}
      summary={t(`items.${slug}.summary`)}
      description={t(`items.${slug}.description`)}
      breadcrumb={{
        label: tCommon("breadcrumb"),
        items: [
          { label: tCommon("home"), href: "/" },
          { label: t("eyebrow"), href: "/services" },
          { label: title },
        ],
      }}
      lists={[
        {
          title: t("deliverables"),
          items: LETTERS.map((l) => t(`items.${slug}.deliverables.${l}`)),
        },
      ]}
      aside={{ title: t("forWhom"), text: t(`items.${slug}.forWhom`) }}
      related={{
        title: tCommon("allServices"),
        linkLabel: tCommon("learnMore"),
        items: SERVICES.filter((s) => s.slug !== slug).map(({ slug: other, icon }) => ({
          key: other,
          icon,
          title: t(`items.${other}.title`),
          summary: t(`items.${other}.summary`),
          href: { pathname: "/services/[slug]", params: { slug: other } },
        })),
      }}
      cta={{ title: t("ctaTitle"), text: t("ctaText"), actionLabel: tCommon("contactUs") }}
    />
  );
}
