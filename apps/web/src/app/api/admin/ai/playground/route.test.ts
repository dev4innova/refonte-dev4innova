import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("@/lib/server-env", () => ({ getApiUrl: () => "http://api.test" }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "https://www.example.com" }));

const { POST } = await import("./route");

function request(headers: Record<string, string>) {
  return new Request("https://www.example.com/api/admin/ai/playground", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.example.com", ...headers },
    body: JSON.stringify({ message: "Bonjour" }),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  getSession.mockResolvedValue({ accessToken: "secret-token" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/admin/ai/playground", () => {
  it("refuses other origins and non-JSON bodies", async () => {
    expect((await POST(request({ origin: "https://evil.example" }))).status).toBe(403);
    const noOrigin = request({});
    noOrigin.headers.delete("origin");
    expect((await POST(noOrigin)).status).toBe(403);
    expect((await POST(request({ "content-type": "text/plain" }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
  });

  it("relays the event stream with the user's token, which never reaches the browser", async () => {
    fetchMock.mockResolvedValue(
      new Response('event: delta\ndata: {"text":"Hi"}\n\n', {
        headers: { "content-type": "text/event-stream" },
      }),
    );
    const response = await POST(request({}));
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toBe('event: delta\ndata: {"text":"Hi"}\n\n');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/admin/ai/playground");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(init.body).toBe('{"message":"Bonjour"}');
  });

  it("passes API errors through (quota, validation)", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":{"code":"ai_quota_exceeded"}}', {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await POST(request({}));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: { code: "ai_quota_exceeded" } });
  });

  it("answers 503 when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect((await POST(request({}))).status).toBe(503);
  });
});
