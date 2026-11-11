import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-url";

/**
 * Redirect with a relative Location header (a same-site path): the browser resolves it
 * against the address it is visiting. Never build it from `request.url`: behind a proxy
 * (Railway), that URL carries the internal address of the server (0.0.0.0:3000), not
 * the public domain.
 */
export function redirectToPath(path: string, status: 303 | 307 = 307): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Only same-site paths are allowed");
  return new NextResponse(null, { status, headers: { Location: path } });
}

/**
 * Public origin for redirects the proxy must make absolute (Next.js refuses relative ones
 * there): SITE_URL when set (production), else the request's own origin (local, CI).
 */
export function publicOrigin(requestOrigin: string): string {
  const site = process.env.SITE_URL;
  return site ? new URL(site).origin : requestOrigin;
}

/**
 * A form of this site: no Origin (old browsers, same-origin GET), or an Origin whose host is
 * the one the browser asked for (Host header) or the public site. Never request.url: behind
 * Railway's proxy it carries the internal address (0.0.0.0:3000).
 */
export function isSameSite(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  try {
    const { host: originHost } = new URL(origin);
    return originHost === host || originHost === new URL(getSiteUrl()).host;
  } catch {
    return false;
  }
}
