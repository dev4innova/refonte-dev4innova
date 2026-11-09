import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { relayPdf } from "@/lib/pdf-relay";
import { isUuid } from "@/lib/sse-relay";

type Context = { params: Promise<{ org: string; kind: string; id: string }> };

/** GET /api/billing/{org}/{quotes|invoices}/{id} — PDF for the organization's owners and admins. */
export async function GET(_request: Request, { params }: Context) {
  const { org, kind, id } = await params;
  if (!isUuid(org) || !isUuid(id) || (kind !== "quotes" && kind !== "invoices")) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  return relayPdf(`/api/v1/organizations/${org}/billing/${kind}/${id}/pdf`, session.accessToken);
}
