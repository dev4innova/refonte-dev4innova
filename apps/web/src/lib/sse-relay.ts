import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { forwardedForHeader } from "@/lib/client-ip";
import { getApiUrl } from "@/lib/server-env";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Relays a streamed answer (Server-Sent Events) from the API to the browser, for a JSON
 * POST from this site. The session's access token stays on the server. Server Actions
 * cannot stream, hence these routes.
 */
export async function relaySse(
  request: Request,
  apiPath: string,
  { authenticated = true }: { authenticated?: boolean } = {},
): Promise<Response> {
  // Same-origin JSON requests only (no cross-site form can send JSON without CORS).
  if (request.headers.get("origin") !== new URL(getSiteUrl()).origin) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: { code: "unsupported_media_type" } }, { status: 415 });
  }
  const session = authenticated ? await getSession() : null;
  if (authenticated && !session) {
    return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${getApiUrl()}${apiPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(await forwardedForHeader()),
      },
      body: await request.text(),
      signal: request.signal, // the visitor leaves: stop the upstream call too
    });
  } catch {
    return NextResponse.json({ error: { code: "unavailable" } }, { status: 503 });
  }
  if (!upstream.ok || !upstream.body) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Diagnostic link tokens: URL-safe base64 (secrets.token_urlsafe(32) on the API). */
export function isToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,100}$/.test(value);
}
