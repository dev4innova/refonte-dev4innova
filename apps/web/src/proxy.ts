import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { SESSION_COOKIE } from "./lib/auth/cookie-names";
import { isProtectedPath } from "./lib/auth/protected-paths";

const intl = createMiddleware(routing);

/**
 * Next.js 16 "proxy" (formerly middleware):
 * 1. Protected pages without a session cookie are sent to sign-in right away. This is only
 *    an optimistic check: pages verify the session themselves (src/lib/auth/session.ts).
 * 2. Locale routing: redirects `/` and unprefixed paths to the user's locale (cookie,
 *    then Accept-Language, then French) and rewrites localized pathnames.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isProtectedPath(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/api/auth/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return intl(request);
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
