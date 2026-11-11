import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import "../globals.css";

import { LocaleSwitcher, LocaleSwitcherView } from "@/components/layout/locale-switcher";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ctaNavigation, footerNavigation, legalNavigation, mainNavigation } from "@/config/navigation";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { getSiteUrl } from "@/lib/site-url";

type Props = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

/** Every locale is prerendered at build time. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: t("title"), template: `%s — ${t("siteName")}` },
    description: t("description"),
    openGraph: { siteName: t("siteName"), locale: locale === "fr" ? "fr_FR" : "en_US" },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [tNav, tFooter, tBrand, tLayout, tLocale] = await Promise.all([
    getTranslations("Navigation"),
    getTranslations("Footer"),
    getTranslations("Brand"),
    getTranslations("Layout"),
    getTranslations("LocaleSwitcher"),
  ]);

  const localeOptions = routing.locales.map((l) => ({ locale: l, name: tLocale(l) }));

  return (
    <html lang={locale} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        {/* Client components receive translated strings as props: no messages are sent to the browser. */}
        <NextIntlClientProvider messages={null}>
          <a
            href="#main-content"
            className="sr-only z-50 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            {tLayout("skipToContent")}
          </a>
          <SiteHeader
            items={mainNavigation.map(({ href, labelKey }) => ({ href, label: tNav(labelKey) }))}
            cta={{ href: ctaNavigation.href, label: tNav(ctaNavigation.labelKey) }}
            account={{ href: "/account", label: tNav("account") }}
            labels={{
              navigation: tNav("landmark"),
              openMenu: tNav("openMenu"),
              closeMenu: tNav("closeMenu"),
              menuTitle: tNav("menuTitle"),
              home: tNav("home"),
            }}
            localeSwitcher={
              <Suspense
                fallback={
                  <LocaleSwitcherView
                    label={tLocale("label")}
                    options={localeOptions}
                    current={locale}
                    href="/"
                  />
                }
              >
                <LocaleSwitcher label={tLocale("label")} options={localeOptions} />
              </Suspense>
            }
          />
          <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <SiteFooter
            tagline={tBrand("tagline")}
            description={tBrand("description")}
            navigationLabel={tFooter("landmark")}
            columns={footerNavigation.map((column) => ({
              title: tFooter(column.titleKey),
              links: column.links.map(({ href, labelKey }) => ({ href, label: tNav(labelKey) })),
            }))}
            legalLinks={legalNavigation.map(({ href, labelKey }) => ({
              href,
              label: tFooter(labelKey),
            }))}
            copyright={tFooter("copyright")}
            routesTitle={tFooter("routesTitle")}
            routes={(["contact", "diagnostic"] as const).map((key) => ({
              href: key === "contact" ? "/contact" : "/diagnostic",
              label: tFooter(`routes.${key}.title`),
              text: tFooter(`routes.${key}.text`),
              action: tFooter(`routes.${key}.action`),
            }))}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
