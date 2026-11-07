import { describe, expect, it } from "vitest";

import { parseContactForm, submittedValues } from "./schema";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const VALID = {
  name: " Camille Durand ",
  email: "camille@example.com",
  company: "Acme",
  topic: "training",
  message: "Nous voulons former nos équipes à l'IA générative.",
  consent: "on",
  website: "",
};

describe("parseContactForm", () => {
  it("accepts a valid form and trims values", () => {
    const result = parseContactForm(form(VALID));

    expect(result).toEqual({
      success: true,
      data: {
        name: "Camille Durand",
        email: "camille@example.com",
        company: "Acme",
        topic: "training",
        message: "Nous voulons former nos équipes à l'IA générative.",
        website: "",
      },
    });
  });

  it("falls back to 'other' for an unknown topic", () => {
    const result = parseContactForm(form({ ...VALID, topic: "hack" }));
    expect(result.success && result.data.topic).toBe("other");
  });

  it.each([
    ["name", { name: "A" }],
    ["email", { email: "not-an-email" }],
    ["message", { message: "Trop court" }],
    ["message", { message: "x".repeat(5001) }],
    ["company", { company: "x".repeat(161) }],
    ["consent", { consent: "" }],
  ])("reports an invalid %s", (field, override) => {
    const result = parseContactForm(form({ ...VALID, ...override }));
    expect(result).toEqual({ success: false, fieldErrors: [field] });
  });

  it("reports every invalid field once", () => {
    const result = parseContactForm(form({ consent: "" }));
    expect(result.success).toBe(false);
    expect(!result.success && result.fieldErrors.sort()).toEqual(["consent", "email", "message", "name"]);
  });
});

describe("submittedValues", () => {
  it("keeps what the visitor typed but never the honeypot", () => {
    const values = submittedValues(form({ ...VALID, website: "spam" }));
    expect(values).not.toHaveProperty("website");
    expect(values.name).toBe(" Camille Durand ");
  });
});
