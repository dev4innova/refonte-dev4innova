import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import type * as React from "react";

import { Section } from "@/components/layout/section";
import { Breadcrumb } from "@/components/marketing/breadcrumb";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { getPathname, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { type Content, type ContentType, getContent } from "@/lib/cms";

import { Prose } from "./prose";

/** Detail routes of CMS content, each with a `[slug]` param. */
export type CmsDetailPathname = "/services/[slug]" | "/insights/[slug]" | "/portfolio/[slug]";
type ListPathname = "/services" | "/insights" | "/portfolio";

const LIST_OF: Record<CmsDetailPathname, ListPathname> = {
  "/services/[slug]": "/services",
  "/insights/[slug]": "/insights",
  "/portfolio/[slug]": "/portfolio",
};

/** Title, description, canonical and hreflang from the CMS (translated slugs). */
export async function cmsMetadata(
  type: ContentType,
  pathname: CmsDetailPathname,
  locale: Locale,
  slug: string,
): Promise<Metadata> {
  const content = await getContent(type, locale, slug);
  if (!content) return { robots: { index: false } };
  const href = (l: Locale) => ({ pathname, params: { slug: content.slugs[l] ?? slug } });
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, getPathname({ locale: l, href: href(l) })]),
  );
  const description = content.seo_description || content.summary;
  return {
    title: content.seo_title || content.title,
    description,
    alternates: {
      canonical: getPathname({ locale, href: href(locale) }),
      languages: { ...languages, "x-default": languages[routing.defaultLocale] },
    },
    openGraph: {
      type: type === "article" ? "article" : "website",
      title: content.title,
      description,
      ...(content.cover ? { images: [{ url: content.cover.url, alt: content.cover.alt }] } : {}),
      ...(content.published_at ? { publishedTime: content.published_at } : {}),
    },
  };
}

type CmsDetailProps = {
  type: ContentType;
  pathname: CmsDetailPathname;
  params: Promise<{ locale: Locale; slug: string }>;
  /** Section name in the breadcrumb and eyebrow, e.g. "Insights". */
  sectionLabel: string;
  cta: { title: string; text: string; actionLabel: string };
  /** Extra content under the body (e.g. related items). */
  children?: (content: Content) => React.ReactNode;
};

/** Loads a CMS document and renders it; render inside <Suspense> (request-time data). */
export async function CmsDetail({ type, pathname, params, sectionLabel, cta, children }: CmsDetailProps) {
  const { locale, slug } = await params;
  const content = await getContent(type, locale, slug);
  if (!content) notFound();

  // Visitor came with the slug of another language (language switch): canonical URL.
  const canonicalSlug = content.slugs[locale];
  if (canonicalSlug && canonicalSlug !== slug) {
    redirect({ href: { pathname, params: { slug: canonicalSlug } }, locale });
  }

  const [tCommon, format] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getFormatter({ locale }),
  ]);
  const date =
    type === "article" && content.published_at
      ? format.dateTime(new Date(content.published_at), { dateStyle: "long" })
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow={date ?? sectionLabel}
        title={content.title}
        lead={content.summary}
        before={
          <Breadcrumb
            label={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: sectionLabel, href: LIST_OF[pathname] },
              { label: content.title },
            ]}
          />
        }
      />
      <Section variant="card">
        {content.cover ? (
          <Image
            src={content.cover.url}
            alt={content.cover.alt}
            width={content.cover.width}
            height={content.cover.height}
            // Served by the object storage CDN, already re-encoded at upload.
            unoptimized
            priority
            className="mb-10 h-auto w-full max-w-3xl rounded-xl"
          />
        ) : null}
        <Prose html={content.body_html} />
      </Section>
      {children?.(content)}
      <CtaBand title={cta.title} text={cta.text} actionLabel={cta.actionLabel} />
    </>
  );
}

/** Fallback of the <Suspense> around CmsDetail. */
export function CmsDetailSkeleton() {
  return (
    <>
      <Section variant="inverse">
        <div aria-hidden="true" className="flex max-w-3xl flex-col gap-6">
          <div className="h-4 w-40 rounded bg-inverse-border" />
          <div className="h-14 w-full rounded bg-inverse-border" />
          <div className="h-6 w-2/3 rounded bg-inverse-border" />
        </div>
      </Section>
      <Section variant="card">
        <div aria-hidden="true" className="flex max-w-3xl flex-col gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-5 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </Section>
    </>
  );
}
