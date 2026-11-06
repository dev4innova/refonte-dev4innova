import { connection } from "next/server";

import { serverApi } from "@/lib/api";
import { checkBackend } from "@/lib/health";

/**
 * Frontend health check: the Next.js server is up and can reach the backend.
 * GET /api/health → 200 when the backend answers, 503 otherwise.
 */
export async function GET() {
  await connection(); // always evaluated at request time, never prerendered
  const backend = await checkBackend(serverApi());
  const ok = backend.status === "ok";
  return Response.json(
    { status: ok ? "ok" : "error", service: "dev4innova-web", backend },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
