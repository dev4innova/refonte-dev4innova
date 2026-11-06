import "server-only";

import { createApiClient } from "@dev4innova/api-client";

import { getApiUrl } from "@/lib/server-env";

/**
 * API client for Server Components and Route Handlers (calls the backend directly).
 * Pass the session's access token to call authenticated endpoints.
 */
export function serverApi(accessToken?: string) {
  return createApiClient(getApiUrl(), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}
