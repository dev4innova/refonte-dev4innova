import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const client = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() };

vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("@/lib/admin", () => ({ adminApi: () => client }));

const actions = await import("./actions");

function reply(status: number, data?: unknown, error?: unknown) {
  return { data, error, response: new Response(null, { status }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ accessToken: "token" });
});

const lead = { email: " ana@example.com ", name: " Ana ", company: " ", phone: "", locale: "fr" as const };

describe("CRM Server Actions", () => {
  it("asks to sign in without a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await actions.createLead(lead)).toEqual({ ok: false, error: "signin" });
  });

  it("creates a prospect with trimmed values and empty fields as null", async () => {
    client.POST.mockResolvedValue(reply(201, { id: "lead-1" }));
    expect(await actions.createLead(lead)).toEqual({ ok: true, data: { id: "lead-1" } });
    expect(client.POST.mock.calls[0]?.[1].body).toEqual({
      email: "ana@example.com",
      name: "Ana",
      company: null,
      phone: null,
      locale: "fr",
    });
  });

  it("points to the existing prospect on a duplicate address", async () => {
    client.POST.mockResolvedValue(reply(409, undefined, { error: { details: { lead_id: "lead-0" } } }));
    expect(await actions.createLead(lead)).toEqual({ ok: false, error: "duplicate", leadId: "lead-0" });
  });

  it.each([
    [403, undefined, "forbidden"],
    [404, undefined, "forbidden"],
    [422, { error: { details: { field: "owner_id" } } }, "notAssignable"],
    [422, { error: { details: {} } }, "validation"],
    [500, undefined, "generic"],
  ])("maps HTTP %i to %s", async (status, error, expected) => {
    client.PUT.mockResolvedValue(reply(status, undefined, error));
    expect(await actions.assignLead("lead-1", "user-2")).toEqual({ ok: false, error: expected });
  });

  it("refuses an invalid amount before calling the API", async () => {
    const result = await actions.createOpportunity({ leadId: "l", title: "Deal", amount: "abc", expectedCloseOn: "" });
    expect(result).toEqual({ ok: false, error: "validation" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("sends explicit clears when an opportunity value is emptied", async () => {
    client.PATCH.mockResolvedValue(reply(200, {}));
    await actions.updateOpportunity("o-1", { amount: "", expectedCloseOn: "" });
    expect(client.PATCH.mock.calls[0]?.[1].body).toMatchObject({
      amount: null,
      clear_amount: true,
      expected_close_on: null,
      clear_expected_close_on: true,
      clear_owner: false,
    });
  });

  it("moves an opportunity to another stage without touching the rest", async () => {
    client.PATCH.mockResolvedValue(reply(200, {}));
    expect(await actions.updateOpportunity("o-1", { stage: "won" })).toEqual({ ok: true, data: undefined });
    expect(client.PATCH.mock.calls[0]?.[1].body).toEqual({
      stage: "won",
      title: null,
      amount: null,
      clear_amount: false,
      expected_close_on: null,
      clear_expected_close_on: false,
      owner_id: null,
      clear_owner: false,
    });
  });

  it("logs an activity at the given time, or now", async () => {
    client.POST.mockResolvedValue(reply(201, {}));
    await actions.addActivity("lead-1", { type: "call", body: "Appel", occurredAt: "", opportunityId: null });
    expect(client.POST.mock.calls[0]?.[1].body.occurred_at).toBeNull();
  });

  it("erases a prospect", async () => {
    client.DELETE.mockResolvedValue(reply(204));
    expect(await actions.deleteLead("lead-1")).toEqual({ ok: true, data: undefined });
  });
});
