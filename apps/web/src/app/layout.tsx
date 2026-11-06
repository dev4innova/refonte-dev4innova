import type { Metadata } from "next";

import "./globals.css";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { siteContent } from "@/content/site";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: `${siteContent.brand.name} — ${siteContent.brand.tagline}`,
    template: `%s — ${siteContent.brand.name}`,
  },
  description: siteContent.brand.description,
};

// Locale-aware layout (`app/[locale]`) arrives with next-intl in EPIC 03.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { nav, footer, brand } = siteContent;

  return (
    <html lang="fr" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {siteContent.skipToContent}
        </a>
        <SiteHeader items={[...nav.items]} labels={nav.labels} cta={nav.cta} />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter
          tagline={brand.tagline}
          description={brand.description}
          columns={footer.columns.map((c) => ({ ...c, links: [...c.links] }))}
          legalLinks={[...footer.legalLinks]}
          copyright={footer.copyright}
          navigationLabel={footer.navigationLabel}
        />
      </body>
    </html>
  );
}
