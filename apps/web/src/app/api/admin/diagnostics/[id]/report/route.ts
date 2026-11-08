import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { relayPdf } from "@/lib/pdf-relay";
import { isUuid } from "@/lib/sse-relay";

type Context = { params: Promise<{ id: string }> };

/** GET /api/admin/diagnostics/{id}/report — PDF report for staff (the API checks the role). */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  return relayPdf(`/api/v1/admin/crm/diagnostics/${id}/report.pdf`, session.accessToken);
}
