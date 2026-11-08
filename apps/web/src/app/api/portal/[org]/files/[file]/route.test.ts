import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-env", () => ({ getApiUrl: () => "http://api.test" }));
const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const client = await import("./route");
const staff = await import("../../../../admin/portal/files/[file]/route");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => vi.clearAllMocks());

const ORG = "11111111-2222-4333-8444-555555555555";
const FILE = "66666666-7777-4888-9999-000000000000";
const context = (params: Record<string, string>) => ({ params: Promise.resolve(params) as never });
const request = new Request("https://www.example.com/x");

describe("portal download routes", () => {
  it("refuse malformed identifiers and anonymous visitors", async () => {
    expect((await client.GET(request, context({ org: "../admin", file: FILE }))).status).toBe(404);
    expect((await staff.GET(request, context({ file: "x" }))).status).toBe(404);
    getSession.mockResolvedValue(null);
    expect((await client.GET(request, context({ org: ORG, file: FILE }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirect to the signed link the API issued with the session token", async () => {
    getSession.mockResolvedValue({ accessToken: "tok" });
    fetchMock.mockResolvedValue(Response.json({ url: "https://s3.example.com/a.pdf?X-Amz-Signature=1", expires_in: 300 }));
    const response = await client.GET(request, context({ org: ORG, file: FILE }));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://s3.example.com/a.pdf?X-Amz-Signature=1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test/api/v1/organizations/${ORG}/portal/files/${FILE}/download`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("pass refusals through and never redirect elsewhere than http(s)", async () => {
    getSession.mockResolvedValue({ accessToken: "tok" });
    fetchMock.mockResolvedValue(Response.json({ error: {} }, { status: 404 }));
    expect((await staff.GET(request, context({ file: FILE }))).status).toBe(404);
    fetchMock.mockResolvedValue(Response.json({ url: "javascript:alert(1)" }));
    expect((await staff.GET(request, context({ file: FILE }))).status).toBe(503);
  });
});
