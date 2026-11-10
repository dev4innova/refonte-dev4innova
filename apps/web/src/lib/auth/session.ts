import "server-only";

import { cookies } from "next/headers";

import { getSiteUrl } from "@/lib/site-url";

import { SESSION_COOKIE } from "./cookie-names";

export { SESSION_COOKIE };

export type Session = {
  /** Opaque session token issued by the API (ADR-0019), sent as a Bearer token. */
  accessToken: string;
};

/**
 * Reads the session cookie. The API checks the token on every call: an expired or
 * revoked session answers 401 and the page sends the user to sign-in.
 */
export async function getSession(): Promise<Session | null> {
  // Reading cookies marks the caller as request-time: never prerendered (Cache Components).
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { accessToken: token } : null;
}

/**
 * Stores the token in an httpOnly cookie: unreadable by scripts, sent to this site only
 * (SameSite=Lax), over HTTPS in production. Server Actions and Route Handlers only.
 */
export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getSiteUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/" });
}
