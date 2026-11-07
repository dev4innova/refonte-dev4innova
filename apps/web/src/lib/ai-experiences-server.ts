import "server-only";

import { cache } from "react";

import { serverApi } from "@/lib/api";
import { requireSession } from "@/lib/admin";

/** The signed-in user's membership in an organization, or null (not a member). */
export const getMembership = cache(async (returnTo: string, org: string) => {
  const session = await requireSession(returnTo);
  const { data } = await serverApi(session.accessToken)
    .GET("/api/v1/me")
    .catch(() => ({ data: undefined }));
  const membership = data?.memberships.find((m) => m.organization_id === org) ?? null;
  return { session, membership };
});
