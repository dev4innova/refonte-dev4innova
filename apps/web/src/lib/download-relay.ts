import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getApiUrl } from "@/lib/server-env";

/**
 * Portal downloads (TASK-099, TASK-100): asks the API for a short-lived signed link with the
 * session token (the API checks access), then redirects the browser to it. The bucket stays
 * private and the token never reaches the browser.
 */
export async function redirectToDownload(apiPath: string): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${getApiUrl()}${apiPath}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: { code: "unavailable" } }, { status: 503 });
  }
  const body = (await upstream.json().catch(() => null)) as { url?: unknown } | null;
  if (!upstream.ok || typeof body?.url !== "string" || !/^https?:\/\//.test(body.url)) {
    return NextResponse.json({ error: { code: "unavailable" } }, { status: upstream.ok ? 503 : upstream.status });
  }
  const response = NextResponse.redirect(body.url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
