import { describe, expect, it } from "vitest";

import { scrubEvent, scrubUrl } from "./sentry-scrub";

describe("Sentry scrubbing", () => {
  it("masks the secret link of a diagnostic and drops query strings", () => {
    expect(scrubUrl("https://www.dev4innova.fr/fr/diagnostic-ia/resultat/AbC_123-xyz?utm=1")).toBe(
      "https://www.dev4innova.fr/fr/diagnostic-ia/resultat/[token]",
    );
    expect(scrubUrl("/en/ai-diagnostic/result/secret#top")).toBe("/en/ai-diagnostic/result/[token]");
    expect(scrubUrl("/api/diagnostic/token/report")).toBe("/api/diagnostic/token/report");
  });

  it("keeps no personal data", () => {
    const event = scrubEvent({
      request: { url: "https://x.fr/fr/diagnostic-ia/resultat/tok?email=a@b.c", headers: { cookie: "s" }, data: "{}" },
      user: { email: "a@b.c" },
      transaction: "/en/ai-diagnostic/result/tok",
      breadcrumbs: [{ data: { from: "/fr/diagnostic-ia/resultat/tok", to: "/fr" } }, { message: "GET /x?token=1" }],
    });
    expect(event).toEqual({
      request: { url: "https://x.fr/fr/diagnostic-ia/resultat/[token]" },
      transaction: "/en/ai-diagnostic/result/[token]",
      breadcrumbs: [{ data: { from: "/fr/diagnostic-ia/resultat/[token]", to: "/fr" } }, { message: "GET /x" }],
    });
  });
});
