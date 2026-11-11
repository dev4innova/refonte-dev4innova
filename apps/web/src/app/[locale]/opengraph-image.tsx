import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { routing, type Locale } from "@/i18n/routing";

/*
 * Open Graph image of every page (1200 × 630), generated at build time per locale:
 * the wordmark with its red "4", the positioning line and the signature filament.
 * Colors are the brand primitives (src/styles/tokens.css): CSS variables are not
 * available to the image renderer.
 */
export const alt = "DEV4INNOVA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const GRAPHITE = "#141417";
const IVORY = "#f7f7f5";
const RED = "#e11927";
const RED_LIGHT = "#ff4757";
const STEEL = "#8b8d98";

export default async function Image({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: GRAPHITE,
          backgroundImage:
            "linear-gradient(rgba(139,141,152,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(139,141,152,0.16) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          color: IVORY,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: RED_LIGHT }}>
          {t("hero.eyebrow").toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 132, fontWeight: 700, letterSpacing: -5 }}>
            <span>Dev</span>
            <span style={{ color: RED }}>4</span>
            <span>Innova</span>
          </div>
          <div style={{ display: "flex", fontSize: 44, color: IVORY }}>{t("title")}</div>
        </div>
        <svg width="1040" height="40" viewBox="0 0 1040 40" fill="none">
          <path d="M0 20h420l20-16h300l20 16h280" stroke={RED} strokeWidth="3" strokeLinecap="round" />
          <circle cx="440" cy="4" r="4" fill={RED} />
          <circle cx="740" cy="4" r="4" fill={RED} />
          <path d="M0 38h1040" stroke={STEEL} strokeOpacity="0.4" />
        </svg>
      </div>
    ),
    size,
  );
}
