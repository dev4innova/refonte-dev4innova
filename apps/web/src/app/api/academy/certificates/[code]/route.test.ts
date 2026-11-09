import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-env", () => ({ getApiUrl: () => "http://api.test" }));
const route = await import("./route");
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => vi.clearAllMocks());

const context = (code: string) => ({ params: Promise.resolve({ code }) });

describe("certificate PDF route", () => {
  it("refuses anything but a certificate code", async () => {
    expect((await route.GET(new Request("https://x/"), context("../admin"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays the PDF in the requested language", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-1.4"));
    const response = await route.GET(new Request("https://x/?locale=en"), context("d4i-7kq2-m9xa-p3tz"));
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/api/v1/academy/certificates/D4I-7KQ2-M9XA-P3TZ/pdf?locale=en");
  });
});
