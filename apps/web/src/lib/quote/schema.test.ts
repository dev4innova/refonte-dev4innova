import { describe, expect, it } from "vitest";

import { parseQuoteForm, submittedQuoteValues } from "./schema";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const VALID = {
  name: " Dominique Martin ",
  email: "dominique@example.com",
  company: "Globex",
  phone: "",
  service: "ai-strategy",
  need: "Un assistant pour répondre aux questions de nos clients.",
  budget: "30k_100k",
  timeline: "within_3_months",
  consent: "on",
  website: "",
};

describe("parseQuoteForm", () => {
  it("accepts a valid form and trims values", () => {
    const result = parseQuoteForm(form(VALID));
    expect(result).toEqual({
      success: true,
      data: {
        name: "Dominique Martin",
        email: "dominique@example.com",
        company: "Globex",
        phone: "",
        service: "ai-strategy",
        need: "Un assistant pour répondre aux questions de nos clients.",
        budget: "30k_100k",
        timeline: "within_3_months",
        website: "",
      },
    });
  });

  it("falls back for unknown choices instead of refusing the request", () => {
    const result = parseQuoteForm(form({ ...VALID, service: "../admin", budget: "a lot", timeline: "x" }));
    expect(result.success && [result.data.service, result.data.budget, result.data.timeline]).toEqual([
      "",
      "unknown",
      "unknown",
    ]);
  });

  it.each([
    ["name", { name: "A" }],
    ["email", { email: "nope" }],
    ["need", { need: "Trop court" }],
    ["phone", { phone: "1".repeat(41) }],
    ["consent", { consent: "" }],
  ])("reports an invalid %s", (field, override) => {
    expect(parseQuoteForm(form({ ...VALID, ...override }))).toEqual({ success: false, fieldErrors: [field] });
  });
});

describe("submittedQuoteValues", () => {
  it("keeps what the visitor typed but never the honeypot", () => {
    const values = submittedQuoteValues(form({ ...VALID, website: "spam", budget: "bogus" }));
    expect(values).not.toHaveProperty("website");
    expect(values.name).toBe(" Dominique Martin ");
    expect(values.budget).toBe("unknown");
  });
});
