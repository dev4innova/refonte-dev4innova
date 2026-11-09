import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { POST: vi.fn(), PUT: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => ({ serverApi: () => client }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({ accessToken: "tok" }) }));

const actions = await import("./actions");
const reply = (status: number, data?: unknown, error?: unknown) => ({ data, error, response: new Response(null, { status }) });

beforeEach(() => vi.clearAllMocks());

describe("client billing Server Actions", () => {
  it("cleans the billing details", async () => {
    client.PUT.mockResolvedValue(reply(200, {}));
    await actions.saveProfile("org", {
      legalName: " Acme ", address: "1 rue", postalCode: "75002", city: "Paris", country: "fr",
      vatNumber: "FR 12 345", siren: "", email: " a@b.co ",
    });
    expect(client.PUT.mock.calls[0]![1].body).toEqual({
      legal_name: "Acme", address: "1 rue", postal_code: "75002", city: "Paris", country: "FR",
      vat_number: "FR12345", siren: null, email: "a@b.co",
    });
  });

  it.each([
    [{ error: { code: "billing_profile_required" } }, "profile"],
    [{ error: { code: "conflict", details: { reason: "expired" } } }, "expired"],
    [{ error: { code: "conflict" } }, "conflict"],
  ])("explains why a quote cannot be accepted", async (body, error) => {
    client.POST.mockResolvedValue(reply(409, undefined, body));
    expect(await actions.acceptQuote("org", "q", "Olga Martin")).toEqual({ ok: false, error });
  });

  it("sends the agreement with the typed name", async () => {
    expect(await actions.acceptQuote("org", "q", " ")).toEqual({ ok: false, error: "validation" });
    client.POST.mockResolvedValue(reply(200, { id: "inv" }));
    expect(await actions.acceptQuote("org", "q", " Olga Martin ")).toEqual({ ok: true, data: { invoiceId: "inv" } });
    expect(client.POST.mock.calls[0]![1].body).toEqual({ name: "Olga Martin", agree: true });
  });

  it("only returns payment pages, and reports an unavailable provider", async () => {
    client.POST.mockResolvedValue(reply(200, { url: "https://checkout.stripe.com/c/pay/cs_1" }));
    expect(await actions.payInvoice("org", "i", "fr")).toEqual({ ok: true, data: { url: "https://checkout.stripe.com/c/pay/cs_1" } });
    client.POST.mockResolvedValue(reply(200, { url: "http://evil.example.com" }));
    expect(await actions.payInvoice("org", "i", "fr")).toEqual({ ok: false, error: "payment" });
    client.POST.mockResolvedValue(reply(503, undefined, { error: { code: "service_unavailable" } }));
    expect(await actions.subscribe("org", "p", "en")).toEqual({ ok: false, error: "payment" });
  });

  it("buys a course personally when no organization is chosen", async () => {
    client.POST.mockResolvedValue(reply(200, { url: "https://checkout.stripe.com/c/pay/cs_2" }));
    await actions.buyCourse("ia", "", "en");
    expect(client.POST.mock.calls[0]![1].body).toEqual({ organization_id: null, locale: "en" });
  });
});
