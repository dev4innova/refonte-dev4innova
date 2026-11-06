import { expect, test } from "@playwright/test";

/*
 * Protected routes (TASK-044). The real sign-in happens on Zitadel, which is not available
 * in CI: these tests check everything up to the redirection to the identity provider.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "routing behaviour is viewport-independent");
});

test.describe("client area", () => {
  for (const [path, encoded] of [
    ["/fr/espace-client", "%2Ffr%2Fespace-client"],
    ["/en/account", "%2Fen%2Faccount"],
  ] as const) {
    test(`${path} sends anonymous visitors to sign-in`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toMatch(
        new RegExp(`/api/auth/login\\?returnTo=${encoded}$`),
      );
    });
  }

  test("a forged session cookie does not open the client area", async ({ page, context, baseURL }) => {
    // A cookie is present, so the proxy lets the request through: the page itself must
    // reject the invalid session (streamed redirect) and send the visitor to sign-in.
    await context.addCookies([{ name: "d4i_session", value: "forged-value", url: baseURL! }]);
    await page.goto("/fr/espace-client");

    await expect(page).toHaveURL(/\/api\/auth\/login\?returnTo=%2Ffr%2Fespace-client$/);
    await expect(page.getByText("Mes organisations")).toHaveCount(0);
  });

  test("sign-in answers 503 while authentication is not configured", async ({ request }) => {
    const response = await request.get("/api/auth/login?returnTo=/fr/espace-client", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(503);
  });

  test("sign-out refuses cross-site requests", async ({ request }) => {
    const response = await request.post("/api/auth/logout", {
      maxRedirects: 0,
      headers: { origin: "https://evil.example.com" },
    });
    expect(response.status()).toBe(403);
  });

  test("the header links to the client area in each language", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("link", { name: "Espace client" })).toHaveAttribute(
      "href",
      "/fr/espace-client",
    );
    await page.goto("/en");
    await expect(page.getByRole("link", { name: "Client area" })).toHaveAttribute("href", "/en/account");
  });
});
