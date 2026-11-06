import { Inter, Space_Grotesk } from "next/font/google";

/*
 * Self-hosted at build time by next/font: no request to Google from the browser.
 * The CSS variables are consumed by src/styles/tokens.css (--font-family-body, --font-family-heading).
 */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const fontVariables = `${inter.variable} ${spaceGrotesk.variable}`;
