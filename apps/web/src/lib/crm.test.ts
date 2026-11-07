import { describe, expect, it } from "vitest";

import { isOneOf, LEAD_STATUSES, parseAmount, personLabel, statusTone } from "./crm";

describe("parseAmount", () => {
  it.each([
    ["", null],
    ["  ", null],
    ["12000", "12000"],
    ["12 000,50 €", "12000.50"],
    ["12 000", "12000"],
    ["0.5", "0.5"],
  ])("reads %j as %j", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["abc", "-5", "1.234", "12,000.50", "99999999999"])("refuses %j", (input) => {
    expect(parseAmount(input)).toBeUndefined();
  });
});

describe("helpers", () => {
  it("checks values against a list", () => {
    expect(isOneOf(LEAD_STATUSES, "new")).toBe(true);
    expect(isOneOf(LEAD_STATUSES, "hacked")).toBe(false);
    expect(isOneOf(LEAD_STATUSES, undefined)).toBe(false);
  });

  it("names a person by display name, then email", () => {
    expect(personLabel({ id: "1", display_name: "Sam", email: "sam@example.com" })).toBe("Sam");
    expect(personLabel({ id: "1", display_name: null, email: "sam@example.com" })).toBe("sam@example.com");
    expect(personLabel(null)).toBeNull();
  });

  it("gives each status a tone", () => {
    expect(statusTone("new")).toBe("accent");
    expect(statusTone("won")).toBe("success");
    expect(statusTone("lost")).toBe("muted");
    expect(statusTone("proposal")).toBe("neutral");
  });
});
