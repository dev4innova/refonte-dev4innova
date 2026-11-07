import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getApiUrl } from "@/lib/server-env";
import { getSiteUrl } from "@/lib/site-url";

/**
 * POST /api/admin/ai/playground — relays the AI playground stream (Server-Sent Events)
 * from the API to the browser. The access token stays on the server; the API checks the
 * staff admin role. A Server Action cannot stream, hence this route.
 */
export async function POST(request: Request) {
  // Same-origin JSON requests only (no cross-site form can send JSON without CORS).
  if (request.headers.get("origin") !== new URL(getSiteUrl()).origin) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: { code: "unsupported_media_type" } }, { status: 415 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${getApiUrl()}/api/v1/admin/ai/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
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
