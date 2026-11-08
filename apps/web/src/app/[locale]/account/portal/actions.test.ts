import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() };
const getSession = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => ({ serverApi: () => client }));
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const actions = await import("./actions");

function reply(status: number, data?: unknown, error?: unknown) {
  return { data, error, response: new Response(null, { status }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ accessToken: "tok" });
});

describe("client portal Server Actions", () => {
  it("asks to sign in again without a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await actions.closeTicket("org", "t")).toEqual({ ok: false, error: "signin" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("requires a comment to request changes, before calling the API", async () => {
    expect(await actions.reviewDeliverable("org", "d", "changes_requested", "  ")).toEqual({ ok: false, error: "validation" });
    expect(client.POST).not.toHaveBeenCalled();
    client.POST.mockResolvedValue(reply(200, {}));
    await actions.reviewDeliverable("org", "d", "approved", "");
    expect(client.POST.mock.calls[0]![1].body).toEqual({ decision: "approved", comment: null });
  });

  it.each([
    [403, undefined, "forbidden"],
    [404, undefined, "notFound"],
    [409, undefined, "conflict"],
    [422, { error: { details: { reason: "unsupported_type" } } }, "fileType"],
    [422, { error: { details: { reason: "too_large" } } }, "fileTooLarge"],
    [422, { error: { details: {} } }, "validation"],
    [500, undefined, "generic"],
  ])("maps HTTP %i to an error code", async (status, body, error) => {
    client.POST.mockResolvedValue(reply(status, undefined, body));
    expect(await actions.replyTicket("org", "t", "Bonjour")).toEqual({ ok: false, error });
  });

  it("checks the file and sends it as multipart with the project", async () => {
    const empty = new FormData();
    expect(await actions.uploadDocument("org", empty)).toEqual({ ok: false, error: "fileEmpty" });
    const big = new FormData();
    big.set("file", new File([new Uint8Array(26 * 1024 * 1024)], "big.pdf"));
    expect(await actions.uploadDocument("org", big)).toEqual({ ok: false, error: "fileTooLarge" });
    expect(client.POST).not.toHaveBeenCalled();

    client.POST.mockResolvedValue(reply(201, {}));
    const data = new FormData();
    data.set("file", new File(["%PDF-1.4"], "brief.pdf"));
    data.set("project_id", " p-1 ");
    expect(await actions.uploadDocument("org", data)).toEqual({ ok: true, data: undefined });
    const options = client.POST.mock.calls[0]![1];
    const body = options.bodySerializer() as FormData;
    expect((body.get("file") as File).name).toBe("brief.pdf");
    expect(body.get("project_id")).toBe("p-1");
  });

  it("opens a ticket with trimmed text and no empty project", async () => {
    const input = { subject: " Erreur ", category: "incident", priority: "high", projectId: "", message: "Ça ne marche plus du tout." } as const;
    expect(await actions.createTicket("org", { ...input, subject: "Oh" })).toEqual({ ok: false, error: "validation" });
    client.POST.mockResolvedValue(reply(201, { id: "t-1" }));
    expect(await actions.createTicket("org", input)).toEqual({ ok: true, data: { id: "t-1" } });
    expect(client.POST.mock.calls[0]![1].body).toEqual({
      subject: "Erreur",
      category: "incident",
      priority: "high",
      project_id: null,
      message: "Ça ne marche plus du tout.",
    });
  });
});
