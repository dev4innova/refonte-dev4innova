import { NextResponse } from "next/server";

import { isToken, relaySse } from "@/lib/sse-relay";

type Context = { params: Promise<{ token: string }> };

/** POST /api/diagnostic/{token}/analysis — relays the streamed AI analysis (TASK-092). */
export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  if (!isToken(token)) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  return relaySse(request, `/api/v1/diagnostic/analysis?token=${encodeURIComponent(token)}`, {
    authenticated: false,
  });
}
