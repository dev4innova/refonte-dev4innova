import { describe, expect, it } from "vitest";

import { centsToInput, isCheckoutUrl, lineTotals, money, parseEuros, parseRate, rateLabel } from "./billing";

describe("billing helpers", () => {
  it("formats amounts in the reader's language", () => {
    expect(money(123456, "fr").replace(/\s/g, " ")).toBe("1 234,56 €");
    expect(money(123456, "en")).toBe("€1,234.56");
  });

  it("reads euros typed by a person", () => {
    expect(parseEuros("1 200,50 €")).toBe(120050);
    expect(parseEuros("1200.5")).toBe(120050);
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("12,345")).toBeUndefined();
    expect(parseEuros("abc")).toBeUndefined();
    expect(centsToInput(120050, "fr")).toBe("1200,50");
    expect(centsToInput(120050, "en")).toBe("1200.50");
  });

  it("reads VAT rates in percent", () => {
    expect(parseRate("20")).toBe(2000);
    expect(parseRate("5,5 %")).toBe(550);
    expect(parseRate("101")).toBeUndefined();
    expect(rateLabel(550, "fr")).toBe("5,5 %");
  });

  it("computes totals like the API (VAT rounded per line)", () => {
    expect(lineTotals([{ quantity: 3, unitPriceCents: 3333, vatRateBp: 2000 }, { quantity: 1, unitPriceCents: 50000, vatRateBp: 0 }])).toEqual({
      net: 59999,
      vat: 2000,
      gross: 61999,
    });
  });

  it("only sends the browser to payment pages", () => {
    expect(isCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_1")).toBe(true);
    expect(isCheckoutUrl("http://localhost:8000/api/v1/billing/simulated-checkout/cs_sim")).toBe(true);
    expect(isCheckoutUrl("http://evil.example.com/pay")).toBe(false);
    expect(isCheckoutUrl("javascript:alert(1)")).toBe(false);
  });
});
