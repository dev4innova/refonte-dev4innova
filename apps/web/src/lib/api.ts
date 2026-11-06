import "server-only";

import { createApiClient } from "@dev4innova/api-client";

import { getApiUrl } from "@/lib/server-env";

/** API client for Server Components and Route Handlers (calls the backend directly). */
export function serverApi() {
  return createApiClient(getApiUrl());
}
