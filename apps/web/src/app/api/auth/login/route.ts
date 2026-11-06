import { NextResponse, type NextRequest } from "next/server";
import * as oidc from "openid-client";

import {
  getAuthConfig,
  getOidcConfiguration,
  scopesFor,
  TRANSACTION_COOKIE,
  TRANSACTION_MAX_AGE,
} from "@/lib/auth/config";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { seal } from "@/lib/auth/seal";

/**
 * GET /api/auth/login?returnTo=/fr/espace-client
 * Starts the OIDC authorization code flow with PKCE, state and nonce (TASK-039).
 */
export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) {
    return new NextResponse("Authentication is not configured.", { status: 503 });
  }

  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const locale = returnTo.startsWith("/en") ? "en" : "fr";
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();

  const oidcConfig = await getOidcConfiguration(config);
  const authorizationUrl = oidc.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: config.callbackUrl,
    scope: scopesFor(config),
    response_type: "code",
    code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    state,
    nonce,
    ui_locales: locale,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    TRANSACTION_COOKIE,
    await seal({ codeVerifier, state, nonce, returnTo }, config.sessionSecret, TRANSACTION_MAX_AGE),
    {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: TRANSACTION_MAX_AGE,
    },
  );
  return response;
}
