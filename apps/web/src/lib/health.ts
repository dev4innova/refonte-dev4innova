import type { ApiClient } from "@dev4innova/api-client";

export type BackendHealth =
  | { status: "ok"; service: string; version: string }
  | { status: "error"; reason: string };

/** Asks the backend liveness probe whether the API is reachable. Never throws. */
export async function checkBackend(api: ApiClient, timeoutMs = 2000): Promise<BackendHealth> {
  try {
    const { data, response } = await api.GET("/api/v1/health/live", {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!data) {
      return { status: "error", reason: `http_${response.status}` };
    }
    return { status: "ok", service: data.service, version: data.version };
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unreachable";
    return { status: "error", reason };
  }
}
