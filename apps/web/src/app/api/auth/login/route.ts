import type { NextRequest } from "next/server";

import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { redirectToPath } from "@/lib/redirect-response";

/**
 * GET /api/auth/login?returnTo=/fr/espace-client
 * Kept for every "sign in" link and protected page: sends to the sign-in page (ADR-0019)
 * in the language of the page to come back to.
 */
export function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const prefix = returnTo.split("/")[1];
  const locale: Locale = routing.locales.includes(prefix as Locale)
    ? (prefix as Locale)
    : routing.defaultLocale;
  const signIn = getPathname({ locale, href: "/sign-in" });
  const query = returnTo !== "/" ? `?${new URLSearchParams({ returnTo })}` : "";
  return redirectToPath(`${signIn}${query}`);
}
