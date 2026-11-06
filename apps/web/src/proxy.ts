import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * Locale routing (Next.js 16 "proxy", formerly middleware): redirects `/` and unprefixed
 * paths to the user's locale (cookie, then Accept-Language, then French), and rewrites
 * localized pathnames (`/en/about` → `/en/about` internal route).
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
