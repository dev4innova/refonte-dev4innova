import { describe, expect, it } from "vitest";

import { sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it.each([
    ["/fr/espace-client", "/fr/espace-client"],
    ["/en/account?tab=orgs#top", "/en/account?tab=orgs#top"],
    ["/", "/"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    ["absolute URL", "https://evil.example.com/phish"],
    ["protocol-relative URL", "//evil.example.com"],
    ["backslash trick", "/\\evil.example.com"],
    ["backslash inside", "/fr\\..\\evil"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "fr/espace-client"],
    ["control character", "/fr/\u0000espace"],
    ["missing", null],
    ["empty", ""],
    ["too long", `/${"a".repeat(3000)}`],
  ])("falls back to / for %s", (_, input) => {
    expect(sanitizeReturnTo(input)).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(sanitizeReturnTo("https://evil.example.com", "/fr")).toBe("/fr");
  });
});
