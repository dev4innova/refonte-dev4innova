import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const client = { POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };

vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("@/lib/api", () => ({ serverApi: () => client }));

const actions = await import("./actions");

function reply(status: number, data?: unknown, error?: unknown) {
  return { data, error, response: new Response(null, { status }) };
}

function file(size: number, name = "contrat.pdf") {
  const data = new FormData();
  data.set("file", new File([new Uint8Array(size)], name, { type: "application/pdf" }));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ accessToken: "token" });
});

describe("AI experiences Server Actions", () => {
  it("asks to sign in without a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await actions.createAssistantSession("org")).toEqual({ ok: false, error: "signin" });
  });

  it("creates a conversation and returns its id", async () => {
    client.POST.mockResolvedValue(reply(201, { id: "s-1" }));
    expect(await actions.createAssistantSession("org-1")).toEqual({ ok: true, data: { id: "s-1" } });
    expect(client.POST.mock.calls[0]?.[1].params.path).toEqual({ organization_id: "org-1" });
  });

  it("checks the document before uploading it", async () => {
    expect(await actions.uploadDocument("org", file(0))).toEqual({ ok: false, error: "documentEmpty" });
    expect(await actions.uploadDocument("org", file(10 * 1024 * 1024 + 1))).toEqual({ ok: false, error: "documentTooLarge" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it.each([
    ["type", "documentType"],
    ["empty", "documentEmpty"],
    ["encrypted", "documentEncrypted"],
    ["unreadable", "documentUnreadable"],
    ["too_long", "documentTooLong"],
  ])("explains why the API refused a document (%s)", async (reason, expected) => {
    client.POST.mockResolvedValue(reply(422, undefined, { error: { details: { reason } } }));
    expect(await actions.uploadDocument("org", file(10))).toEqual({ ok: false, error: expected });
  });

  it.each([
    [429, { error: { code: "ai_daily_limit" } }, "dailyLimit"],
    [429, { error: { code: "rate_limited" } }, "rateLimited"],
    [404, undefined, "notFound"],
    [500, undefined, "generic"],
  ])("maps HTTP %i to %s", async (status, error, expected) => {
    client.POST.mockResolvedValue(reply(status, undefined, error));
    expect(await actions.uploadDocument("org", file(10))).toEqual({ ok: false, error: expected });
  });

  it("trims the generator request and refuses a too short topic", async () => {
    const input = { format: "email", tone: "friendly", language: "fr", length: "short", topic: "  Salon IA  ", details: " PME " } as const;
    client.POST.mockResolvedValue(reply(201, { id: "s-2" }));
    expect(await actions.createContentSession("org", input)).toEqual({ ok: true, data: { id: "s-2" } });
    expect(client.POST.mock.calls[0]?.[1].body).toMatchObject({ topic: "Salon IA", details: "PME" });
    expect(await actions.createContentSession("org", { ...input, topic: " x " })).toEqual({ ok: false, error: "validation" });
  });

  it("renames and deletes sessions", async () => {
    client.PATCH.mockResolvedValue(reply(200, {}));
    client.DELETE.mockResolvedValue(reply(204));
    expect(await actions.renameSession("org", "s-1", " Titre ")).toEqual({ ok: true, data: undefined });
    expect(client.PATCH.mock.calls[0]?.[1].body).toEqual({ title: "Titre" });
    expect(await actions.renameSession("org", "s-1", "  ")).toEqual({ ok: false, error: "validation" });
    expect(await actions.deleteSession("org", "s-1")).toEqual({ ok: true, data: undefined });
    expect(await actions.deleteAllSessions("org")).toEqual({ ok: true, data: undefined });
  });
});
