import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { POST: vi.fn(), PUT: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => ({ serverApi: () => client }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({ accessToken: "tok" }) }));

const actions = await import("./actions");
const reply = (status: number, data?: unknown, error?: unknown) => ({ data, error, response: new Response(null, { status }) });
const quote = {
  organizationId: "org",
  title: "Assistant IA",
  notes: "",
  validUntil: "2026-12-31",
  depositPercent: 130,
  lines: [
    { productId: "", description: "Atelier", quantity: "1,5", unitPriceCents: 100000, vatRateBp: 2000 },
    { productId: "", description: "  ", quantity: "1", unitPriceCents: 0, vatRateBp: 2000 },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("back-office billing Server Actions", () => {
  it("drops empty lines, bounds the deposit and sends decimal quantities", async () => {
    client.POST.mockResolvedValue(reply(201, { id: "q-1" }));
    expect(await actions.saveQuote(null, quote)).toEqual({ ok: true, data: { id: "q-1" } });
    const body = client.POST.mock.calls[0]![1].body;
    expect(body.deposit_percent).toBe(100);
    expect(body.lines).toEqual([{ product_id: null, description: "Atelier", quantity: "1.5", unit_price_cents: 100000, vat_rate_bp: 2000 }]);
    expect(body.organization_id).toBe("org");
  });

  it("needs a client, a title and a line", async () => {
    expect(await actions.saveQuote(null, { ...quote, organizationId: "" })).toEqual({ ok: false, error: "validation" });
    expect(await actions.saveQuote("q", { ...quote, lines: [] })).toEqual({ ok: false, error: "validation" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("keeps the interval for subscriptions and the course for courses only", async () => {
    client.POST.mockResolvedValue(reply(201, {}));
    await actions.saveProduct(null, {
      code: "x1", kind: "service", name: { fr: "A", en: "B" }, description: { fr: "", en: "" },
      unitPriceCents: 100, vatRateBp: 2000, interval: "month", courseId: "c", active: true,
    });
    expect(client.POST.mock.calls[0]![1].body).toMatchObject({ interval: null, course_id: null });
  });

  it("reports a code already used", async () => {
    client.PUT.mockResolvedValue(reply(409, undefined, { error: { details: { field: "code" } } }));
    expect(
      await actions.saveProduct("p", {
        code: "x1", kind: "service", name: { fr: "A", en: "B" }, description: { fr: "", en: "" },
        unitPriceCents: 100, vatRateBp: 2000, interval: null, courseId: "", active: true,
      }),
    ).toEqual({ ok: false, error: "code" });
  });
});
