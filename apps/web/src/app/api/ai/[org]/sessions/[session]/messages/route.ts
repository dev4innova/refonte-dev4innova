import { NextResponse } from "next/server";

import { isUuid, relaySse } from "@/lib/sse-relay";

type Context = { params: Promise<{ org: string; session: string }> };

/**
 * POST /api/ai/{org}/sessions/{session}/messages — sends a message of an AI session and
 * relays the streamed answer (EPIC 09). The API checks membership and ownership.
 */
export async function POST(request: Request, { params }: Context) {
  const { org, session } = await params;
  if (!isUuid(org) || !isUuid(session)) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }
  return relaySse(request, `/api/v1/organizations/${org}/ai/sessions/${session}/messages`);
}
