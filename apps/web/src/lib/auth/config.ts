import "server-only";

import * as oidc from "openid-client";

import { getSiteUrl } from "@/lib/site-url";

export { SESSION_COOKIE, TRANSACTION_COOKIE } from "./cookie-names";
export const TRANSACTION_MAX_AGE = 10 * 60;

export type AuthConfig = {
  issuer: string;
  clientId: string;
  projectId: string;
  sessionSecret: string;
  callbackUrl: string;
  postLogoutUrl: string;
  secureCookies: boolean;
};

/** Zitadel settings (ADR-0009). Returns null when authentication is not configured. */
export function getAuthConfig(): AuthConfig | null {
  const { AUTH_ISSUER, AUTH_CLIENT_ID, AUTH_PROJECT_ID, AUTH_SESSION_SECRET } = process.env;
  if (!AUTH_ISSUER || !AUTH_CLIENT_ID || !AUTH_PROJECT_ID || !AUTH_SESSION_SECRET) return null;
  const site = getSiteUrl();
  return {
    issuer: AUTH_ISSUER,
    clientId: AUTH_CLIENT_ID,
    projectId: AUTH_PROJECT_ID,
    sessionSecret: AUTH_SESSION_SECRET,
    callbackUrl: `${site}/api/auth/callback`,
    postLogoutUrl: site,
    secureCookies: site.startsWith("https://"),
  };
}

/**
 * Scopes: identity, a refresh token, and Zitadel's audience scope so that the access
 * token's `aud` contains the project ID checked by the API.
 */
export function scopesFor(config: AuthConfig): string {
  return [
    "openid",
    "profile",
    "email",
    "offline_access",
    `urn:zitadel:iam:org:project:id:${config.projectId}:aud`,
  ].join(" ");
}

let discovered: Promise<oidc.Configuration> | null = null;

/** OIDC discovery, cached for the process lifetime. Public client with PKCE: no secret. */
export function getOidcConfiguration(config: AuthConfig): Promise<oidc.Configuration> {
  discovered ??= oidc
    .discovery(new URL(config.issuer), config.clientId, undefined, oidc.None())
    .catch((error: unknown) => {
      discovered = null;
      throw error;
    });
  return discovered;
}
