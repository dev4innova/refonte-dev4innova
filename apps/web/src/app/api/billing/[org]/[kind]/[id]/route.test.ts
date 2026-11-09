import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-env", () => ({ getApiUrl: () => "http://api.test" }));
const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const client = await import("./route");
const staff = await import("../../../../admin/billing/[kind]/[id]/route");
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => vi.clearAllMocks());

const ORG = "11111111-2222-4333-8444-555555555555";
const ID = "66666666-7777-4888-9999-000000000000";
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) as never });

describe("billing PDF routes", () => {
  it("refuse other documents and anonymous visitors", async () => {
    expect((await client.GET(new Request("https://x"), ctx({ org: ORG, kind: "payments", id: ID }))).status).toBe(404);
    expect((await staff.GET(new Request("https://x"), ctx({ kind: "invoices", id: "x" }))).status).toBe(404);
    getSession.mockResolvedValue(null);
    expect((await client.GET(new Request("https://x"), ctx({ org: ORG, kind: "invoices", id: ID }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relay the PDF with the session token", async () => {
    getSession.mockResolvedValue({ accessToken: "tok" });
    fetchMock.mockResolvedValue(new Response("%PDF", { headers: { "content-disposition": 'attachment; filename="F-2026-0001.pdf"' } }));
    const response = await client.GET(new Request("https://x"), ctx({ org: ORG, kind: "quotes", id: ID }));
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test/api/v1/organizations/${ORG}/billing/quotes/${ID}/pdf`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });
});
