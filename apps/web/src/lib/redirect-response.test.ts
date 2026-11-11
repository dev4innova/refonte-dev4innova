import { afterEach, describe, expect, it, vi } from "vitest";

import { publicOrigin, redirectToPath } from "./redirect-response";

describe("redirectToPath", () => {
  it("keeps the Location relative, so the public domain is used", () => {
    const response = redirectToPath("/fr/connexion?returnTo=%2Ffr%2Fespace-client");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/fr/connexion?returnTo=%2Ffr%2Fespace-client");
    expect(redirectToPath("/", 303).status).toBe(303);
  });

  it("refuses anything that is not a same-site path", () => {
    expect(() => redirectToPath("https://evil.example.com")).toThrow();
    expect(() => redirectToPath("//evil.example.com")).toThrow();
  });
});

describe("publicOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the public site address when it is set", () => {
    vi.stubEnv("SITE_URL", "https://www.dev4innova.com");
    expect(publicOrigin("https://0.0.0.0:3000")).toBe("https://www.dev4innova.com");
  });

  it("falls back to the request origin (local, CI)", () => {
    vi.stubEnv("SITE_URL", "");
    expect(publicOrigin("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100");
  });
});
