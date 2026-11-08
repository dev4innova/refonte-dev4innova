import { NextResponse } from "next/server";

import { relayPdf } from "@/lib/pdf-relay";
import { isToken } from "@/lib/sse-relay";

type Context = { params: Promise<{ token: string }> };

/** GET /api/diagnostic/{token}/report — the PDF report of an unlocked diagnostic. */
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  if (!isToken(token)) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  return relayPdf(`/api/v1/diagnostic/report.pdf?token=${encodeURIComponent(token)}`);
}
