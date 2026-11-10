import { NextResponse } from "next/server";

import { serverApi } from "@/lib/api";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/site-url";

/**
 * POST /api/auth/logout — revokes the session in the API, then clears the cookie.
 * POST only (from a form): a GET could be triggered by any <img> on another site.
 */
export async function POST(request: Request) {
  // Cross-site forms cannot sign the user out (defence in depth on top of SameSite).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(getSiteUrl()).origin && origin !== new URL(request.url).origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const session = await getSession();
  if (session) {
    // API unreachable: the cookie is cleared anyway, the token expires on its own.
    await serverApi(session.accessToken)
      .POST("/api/v1/auth/sign-out")
      .catch(() => undefined);
  }
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
