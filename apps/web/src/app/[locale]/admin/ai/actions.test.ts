import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const client = { POST: vi.fn(), PATCH: vi.fn(), PUT: vi.fn() };

vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("@/lib/admin", () => ({ adminApi: () => client }));

const actions = await import("./actions");

function reply(status: number, error?: unknown) {
  return { data: status < 300 ? {} : undefined, error, response: new Response(null, { status }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ accessToken: "token" });
});

describe("AI back-office Server Actions", () => {
  it("asks to sign in without a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await actions.setQuota("org", "10")).toEqual({ ok: false, error: "signin" });
  });

  it.each([
    ["12,50 €", "12.50"],
    [" 100 ", "100"],
    ["", null],
  ])("sends the budget %j as %j", async (input, expected) => {
    client.PUT.mockResolvedValue(reply(204));
    expect(await actions.setQuota("org-1", input)).toEqual({ ok: true, data: undefined });
    expect(client.PUT.mock.calls[0]?.[1].body).toEqual({ monthly_budget_eur: expected });
  });

  it("refuses an invalid budget before calling the API", async () => {
    expect(await actions.setQuota("org-1", "0,0001")).toEqual({ ok: false, error: "validation" });
    expect(await actions.setQuota("org-1", "-5")).toEqual({ ok: false, error: "validation" });
    expect(client.PUT).not.toHaveBeenCalled();
  });

  it.each([
    [403, undefined, "forbidden"],
    [409, { error: { details: { field: "model_id" } } }, "duplicate"],
    [409, { error: { details: {} } }, "conflict"],
    [422, undefined, "validation"],
    [500, undefined, "generic"],
  ])("maps HTTP %i to %s", async (status, error, expected) => {
    client.PATCH.mockResolvedValue(reply(status, error));
    expect(await actions.updateModel("m-1", { isEnabled: false })).toEqual({ ok: false, error: expected });
  });

  it("only sends the fields being changed", async () => {
    client.PATCH.mockResolvedValue(reply(200));
    await actions.updateModel("m-1", { isDefault: true });
    expect(client.PATCH.mock.calls[0]?.[1].body).toEqual({
      display_name: null,
      input_price_usd_per_mtok: null,
      output_price_usd_per_mtok: null,
      context_window: null,
      max_output_tokens: null,
      options: null,
      is_enabled: null,
      is_default: true,
    });
  });
});
