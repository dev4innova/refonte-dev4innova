import { NextResponse } from "next/server";

import { normalizeCode } from "@/lib/academy";
import { relayPdf } from "@/lib/pdf-relay";

type Context = { params: Promise<{ code: string }> };

/** GET /api/academy/certificates/{code}?locale=fr — PDF of a certificate (public by its code). */
export async function GET(request: Request, { params }: Context) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "fr";
  return relayPdf(`/api/v1/academy/certificates/${code}/pdf?locale=${locale}`);
}
