import { NextResponse } from "next/server";

import { redirectToDownload } from "@/lib/download-relay";
import { isUuid } from "@/lib/sse-relay";

/** Download of a portal document or deliverable, for a member of the organization. */
export async function GET(_request: Request, { params }: { params: Promise<{ org: string; file: string }> }) {
  const { org, file } = await params;
  if (!isUuid(org) || !isUuid(file)) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  return redirectToDownload(`/api/v1/organizations/${org}/portal/files/${file}/download`);
}
