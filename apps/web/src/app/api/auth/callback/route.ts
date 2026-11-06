import { NextResponse, type NextRequest } from "next/server";
import * as oidc from "openid-client";

import { getAuthConfig, getOidcConfiguration, SESSION_COOKIE, TRANSACTION_COOKIE } from "@/lib/auth/config";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { seal, unseal } from "@/lib/auth/seal";
import type { Session } from "@/lib/auth/session";

type Transaction = { codeVerifier: string; state: string; nonce: string; returnTo: string };

/**
 * GET /api/auth/callback — Zitadel redirects here with the authorization code.
 * Checks state, nonce and PKCE, then stores the access token in an encrypted HttpOnly cookie.
 */
export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) {
    return new NextResponse("Authentication is not configured.", { status: 503 });
  }

  const transaction = await unseal<Transaction>(
    request.cookies.get(TRANSACTION_COOKIE)?.value,
    config.sessionSecret,
  );
  if (!transaction) {
    return new NextResponse("Sign-in expired or invalid. Please try again.", { status: 400 });
  }

  // Rebuild the public URL: behind a proxy, request.url carries the internal host.
  const currentUrl = new URL(`${config.callbackUrl}${request.nextUrl.search}`);
  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(await getOidcConfiguration(config), currentUrl, {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    });
  } catch {
    return new NextResponse("Sign-in failed. Please try again.", { status: 400 });
  }

  const claims = tokens.claims();
  const expiresIn = tokens.expiresIn() ?? 3600;
  const session: Session = {
    sub: String(claims?.sub ?? ""),
    accessToken: tokens.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };

  const response = NextResponse.redirect(
    new URL(sanitizeReturnTo(transaction.returnTo), config.postLogoutUrl),
  );
  response.cookies.set(SESSION_COOKIE, await seal(session, config.sessionSecret, expiresIn), {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
  response.cookies.delete({ name: TRANSACTION_COOKIE, path: "/api/auth" });
  return response;
}
