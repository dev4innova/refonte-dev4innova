import { describe, expect, it } from "vitest";

import { isSameSite } from "./redirect-response";

describe("sign-out origin check", () => {
  it("accepts forms of the site, whatever the internal address of the server", () => {
    expect(isSameSite("https://www.dev4innova.com", "www.dev4innova.com")).toBe(true);
    expect(isSameSite("http://127.0.0.1:3100", "127.0.0.1:3100")).toBe(true);
    expect(isSameSite(null, "www.dev4innova.com")).toBe(true);
  });

  it("refuses other sites", () => {
    expect(isSameSite("https://evil.example.com", "www.dev4innova.com")).toBe(false);
    expect(isSameSite("not a url", "www.dev4innova.com")).toBe(false);
  });
});
