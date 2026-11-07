import { connection } from "next/server";

import { OfferGrid } from "@/components/marketing/offer-grid";
import { contentIcon } from "@/config/offer";
import type { Locale } from "@/i18n/routing";
import { getContentList } from "@/lib/cms";

/** Published services from the CMS, at request time (cached). */
export async function ServicesGrid({
  locale,
  linkLabel,
  exclude,
}: {
  locale: Locale;
  linkLabel: string;
  exclude?: string;
}) {
  await connection();
  const services = (await getContentList("service", locale)).filter((s) => s.id !== exclude);
  return (
    <OfferGrid
      linkLabel={linkLabel}
      items={services.map((service) => ({
        key: service.id,
        icon: contentIcon(service.attributes.icon),
        title: service.title,
        summary: service.summary,
        href: { pathname: "/services/[slug]", params: { slug: service.slug } },
      }))}
    />
  );
}
