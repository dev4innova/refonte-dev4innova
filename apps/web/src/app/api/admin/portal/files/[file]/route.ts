import { NextResponse } from "next/server";

import { redirectToDownload } from "@/lib/download-relay";
import { isUuid } from "@/lib/sse-relay";

/** Download of a portal file from the back office (staff with portal:manage). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!isUuid(file)) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  return redirectToDownload(`/api/v1/admin/portal/files/${file}/download`);
}
