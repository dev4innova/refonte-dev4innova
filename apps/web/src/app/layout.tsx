import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "DEV4INNOVA",
};

// Locale-aware layout (`app/[locale]`) arrives with next-intl in EPIC 03.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
