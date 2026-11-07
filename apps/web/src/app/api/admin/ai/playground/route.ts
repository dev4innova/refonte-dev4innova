import { relaySse } from "@/lib/sse-relay";

/**
 * POST /api/admin/ai/playground — relays the AI playground stream from the API (staff
 * admins; the API checks the role).
 */
export async function POST(request: Request) {
  return relaySse(request, "/api/v1/admin/ai/playground");
}
