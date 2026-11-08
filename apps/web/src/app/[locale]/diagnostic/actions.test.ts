import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { POST: vi.fn() };
vi.mock("@/lib/api", () => ({ serverApi: () => client }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));

const actions = await import("./actions");

function reply(status: number, data?: unknown, error?: unknown) {
  return { data, error, response: new Response(null, { status }) };
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const VALID = { name: "Camille", email: "camille@example.com", company: " Globex ", consent: "on", website: "" };

beforeEach(() => vi.clearAllMocks());

describe("diagnostic Server Actions", () => {
  it("submits the answers with the visitor's address and returns the token", async () => {
    client.POST.mockResolvedValue(reply(201, { token: "secret-token-value-123" }));
    const result = await actions.submitDiagnostic("en", { "a.q": "a.q.1" }, { size: "1-9" }, "");
    expect(result).toEqual({ ok: true, data: { token: "secret-token-value-123" } });
    const [, options] = client.POST.mock.calls[0]!;
    expect(options.body).toEqual({ locale: "en", answers: { "a.q": "a.q.1" }, profile: { size: "1-9" }, website: "" });
    expect(options.headers).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it.each([
    [422, "incomplete"],
    [429, "rateLimited"],
    [500, "unavailable"],
  ])("maps HTTP %i to %s", async (status, error) => {
    client.POST.mockResolvedValue(reply(status));
    expect(await actions.submitDiagnostic("fr", {}, {}, "")).toEqual({ ok: false, error });
  });

  it("checks the unlock form before calling the API", async () => {
    const result = await actions.unlockDiagnostic("tok", form({ ...VALID, name: "C", email: "nope", consent: "" }));
    expect(result).toEqual({ ok: false, error: "validation", fields: ["name", "email", "consent"] });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("unlocks with trimmed values and the token in the query", async () => {
    client.POST.mockResolvedValue(reply(200, {}));
    expect(await actions.unlockDiagnostic("tok", form(VALID))).toEqual({ ok: true, data: undefined });
    const [, options] = client.POST.mock.calls[0]!;
    expect(options.params).toEqual({ query: { token: "tok" } });
    expect(options.body).toMatchObject({ name: "Camille", company: "Globex", consent: true });
  });

  it("reports an unknown diagnostic", async () => {
    client.POST.mockResolvedValue(reply(404));
    expect(await actions.unlockDiagnostic("tok", form(VALID))).toEqual({ ok: false, error: "notFound" });
  });
});
