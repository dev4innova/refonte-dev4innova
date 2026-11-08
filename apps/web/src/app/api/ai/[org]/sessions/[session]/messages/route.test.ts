import { beforeEach, describe, expect, it, vi } from "vitest";

const relaySse = vi.fn();
vi.mock("@/lib/sse-relay", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sse-relay")>("@/lib/sse-relay");
  return { isUuid: actual.isUuid, relaySse: (...args: unknown[]) => relaySse(...args) };
});
vi.mock("server-only", () => ({}));

const { POST } = await import("./route");

const ORG = "11111111-2222-4333-8444-555555555555";
const SESSION = "66666666-7777-4888-9999-000000000000";
const request = new Request("https://www.example.com/api/ai/x", { method: "POST" });

beforeEach(() => {
  relaySse.mockReset();
  relaySse.mockResolvedValue(new Response("ok"));
});

describe("POST /api/ai/{org}/sessions/{session}/messages", () => {
  it("relays to the session's API endpoint", async () => {
    await POST(request, { params: Promise.resolve({ org: ORG, session: SESSION }) });
    expect(relaySse).toHaveBeenCalledWith(request, `/api/v1/organizations/${ORG}/ai/sessions/${SESSION}/messages`);
  });

  it.each([
    ["../admin", SESSION],
    [ORG, "x/../../admin"],
  ])("refuses identifiers that are not UUIDs (%s, %s)", async (org, session) => {
    const response = await POST(request, { params: Promise.resolve({ org, session }) });
    expect(response.status).toBe(404);
    expect(relaySse).not.toHaveBeenCalled();
  });
});
