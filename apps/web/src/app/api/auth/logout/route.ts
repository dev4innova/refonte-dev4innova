import { NextResponse } from "next/server";

import { serverApi } from "@/lib/api";
import { isSameSite, redirectToPath } from "@/lib/redirect-response";
import { clearSessionCookie, getSession } from "@/lib/auth/session";

/**
 * POST /api/auth/logout — revokes the session in the API, then clears the cookie.
 * POST only (from a form): a GET could be triggered by any <img> on another site.
 */
export async function POST(request: Request) {
  // Cross-site forms cannot sign the user out (defence in depth on top of SameSite).
  if (!isSameSite(request.headers.get("origin"), request.headers.get("host"))) {
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
  return redirectToPath("/", 303);
}
