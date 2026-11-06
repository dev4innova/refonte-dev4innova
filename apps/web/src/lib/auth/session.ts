import "server-only";

import { cookies } from "next/headers";

import { getAuthConfig, SESSION_COOKIE } from "./config";
import { unseal } from "./seal";

export type Session = {
  sub: string;
  accessToken: string;
  /** Unix time (seconds) when the access token expires. */
  expiresAt: number;
};

/**
 * Reads the encrypted session cookie. Returns null when signed out, when the cookie was
 * tampered with or when the access token has expired (the user signs in again; Zitadel's
 * own session usually makes that instant).
 */
export async function getSession(): Promise<Session | null> {
  // Read the cookies FIRST, even when auth is not configured: it marks the caller as
  // request-time. Otherwise Next prerenders it at build time (Cache Components), and a
  // "signed out" result would be frozen into the static page for every visitor.
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const config = getAuthConfig();
  if (!config) return null;
  const session = await unseal<Session>(cookie, config.sessionSecret);
  if (!session || session.expiresAt <= Date.now() / 1000 + 10) return null;
  return session;
}
