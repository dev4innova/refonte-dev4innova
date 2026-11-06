import { NextResponse } from "next/server";
import * as oidc from "openid-client";

import { getAuthConfig, getOidcConfiguration, SESSION_COOKIE } from "@/lib/auth/config";
import { getSiteUrl } from "@/lib/site-url";

/**
 * POST /api/auth/logout — clears the local session, then ends the Zitadel session.
 * POST only (from a form): a GET could be triggered by any <img> on another site.
 */
export async function POST(request: Request) {
  // Cross-site forms cannot sign the user out (defence in depth on top of SameSite).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(getSiteUrl()).origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const config = getAuthConfig();
  let target = new URL(getSiteUrl());

  if (config) {
    try {
      target = oidc.buildEndSessionUrl(await getOidcConfiguration(config), {
        client_id: config.clientId,
        post_logout_redirect_uri: config.postLogoutUrl,
      });
    } catch {
      // Identity provider unreachable: the local session is cleared anyway.
    }
  }

  const response = NextResponse.redirect(target, { status: 303 });
  response.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return response;
}
