import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { relayPdf } from "@/lib/pdf-relay";
import { isUuid } from "@/lib/sse-relay";

type Context = { params: Promise<{ kind: string; id: string }> };

/** GET /api/admin/billing/{quotes|invoices}/{id} — PDF for the staff (the API checks the role). */
export async function GET(_request: Request, { params }: Context) {
  const { kind, id } = await params;
  if (!isUuid(id) || (kind !== "quotes" && kind !== "invoices")) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  return relayPdf(`/api/v1/admin/billing/${kind}/${id}/pdf`, session.accessToken);
}
