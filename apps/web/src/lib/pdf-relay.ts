import "server-only";

import { NextResponse } from "next/server";

import { getApiUrl } from "@/lib/server-env";

/** Relays a PDF produced by the API (TASK-094). */
export async function relayPdf(apiPath: string, accessToken?: string): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(`${getApiUrl()}${apiPath}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: { code: "unavailable" } }, { status: 503 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: { code: "unavailable" } }, { status: upstream.status === 200 ? 503 : upstream.status });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? "attachment",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
