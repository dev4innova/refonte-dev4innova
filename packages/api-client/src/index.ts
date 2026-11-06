import createClient, { type ClientOptions } from "openapi-fetch";

import type { components, paths } from "./generated/schema";

export type { components, paths };
export type ApiSchemas = components["schemas"];

/** Typed client for the DEV4INNOVA API. `baseUrl` is the API origin (without /api/v1). */
export function createApiClient(baseUrl: string, options: Omit<ClientOptions, "baseUrl"> = {}) {
  return createClient<paths>({ baseUrl, ...options });
}

export type ApiClient = ReturnType<typeof createApiClient>;
