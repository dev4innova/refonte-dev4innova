import { createApiClient } from "@dev4innova/api-client";
import { describe, expect, it, vi } from "vitest";

import { checkBackend } from "./health";

function clientWith(fetchImpl: typeof fetch) {
  return createApiClient("http://api.test", { fetch: fetchImpl });
}

describe("checkBackend", () => {
  it("returns ok with service info when the API answers", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ status: "ok", service: "dev4innova-api", version: "0.1.0" }),
    );

    await expect(checkBackend(clientWith(fetchMock))).resolves.toEqual({
      status: "ok",
      service: "dev4innova-api",
      version: "0.1.0",
    });
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://api.test/api/v1/health/live");
  });

  it("reports the HTTP status when the API returns an error", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { code: "internal_error" } }, { status: 500 }),
    );

    await expect(checkBackend(clientWith(fetchMock))).resolves.toEqual({
      status: "error",
      reason: "http_500",
    });
  });

  it("reports unreachable when the network fails", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(checkBackend(clientWith(fetchMock))).resolves.toEqual({
      status: "error",
      reason: "unreachable",
    });
  });
});
