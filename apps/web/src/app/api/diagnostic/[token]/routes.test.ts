import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/server-env", () => ({ getApiUrl: () => "http://api.test" }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "https://www.example.com" }));
const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const analysis = await import("./analysis/route");
const report = await import("./report/route");
const adminReport = await import("../../admin/diagnostics/[id]/report/route");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => vi.clearAllMocks());

const TOKEN = "abcdefghijklmnopqrstuvwxyz_-0123";
const params = (value: Record<string, string>) => ({ params: Promise.resolve(value) as never });

function post() {
  return new Request("https://www.example.com/api/diagnostic/x/analysis", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.example.com" },
    body: "{}",
  });
}

describe("diagnostic routes", () => {
  it("relays the analysis without a session, with the token in the query", async () => {
    fetchMock.mockResolvedValue(new Response("event: done\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } }));
    const response = await analysis.POST(post(), params({ token: TOKEN }));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test/api/v1/diagnostic/analysis?token=${TOKEN}`);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });

  it.each([["short"], ["../../admin/crm"], ["a".repeat(101)]])("refuses malformed tokens (%s)", async (token) => {
    expect((await analysis.POST(post(), params({ token }))).status).toBe(404);
    expect((await report.GET(new Request("https://x"), params({ token }))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the PDF as an attachment, never cached", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-1.4", { headers: { "content-disposition": 'attachment; filename="diagnostic-ia.pdf"' } }));
    const response = await report.GET(new Request("https://x"), params({ token: TOKEN }));
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("diagnostic-ia.pdf");
  });

  it("passes refusals through (report not unlocked)", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    expect((await report.GET(new Request("https://x"), params({ token: TOKEN }))).status).toBe(403);
  });

  it("requires a session and a UUID for the staff report", async () => {
    getSession.mockResolvedValue(null);
    const id = "11111111-2222-4333-8444-555555555555";
    expect((await adminReport.GET(new Request("https://x"), params({ id }))).status).toBe(401);
    expect((await adminReport.GET(new Request("https://x"), params({ id: "x" }))).status).toBe(404);
    getSession.mockResolvedValue({ accessToken: "tok" });
    fetchMock.mockResolvedValue(new Response("%PDF"));
    await adminReport.GET(new Request("https://x"), params({ id }));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test/api/v1/admin/crm/diagnostics/${id}/report.pdf`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });
});
