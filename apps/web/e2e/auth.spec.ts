import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/*
 * Built-in accounts (ADR-0019) and protected routes (TASK-044), against the running API:
 * sign-up, sign-out, sign-in, wrong password, password change.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "routing behaviour is viewport-independent");
});

const PASSWORD = "correct horse battery staple";

test.describe("client area", () => {
  for (const [path, encoded] of [
    ["/fr/espace-client", "%2Ffr%2Fespace-client"],
    ["/en/account", "%2Fen%2Faccount"],
  ] as const) {
    test(`${path} sends anonymous visitors to sign-in`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toMatch(new RegExp(`/api/auth/login\\?returnTo=${encoded}$`));
    });
  }

  test("the sign-in route opens the sign-in page in the language of the page", async ({ request }) => {
    const fr = await request.get("/api/auth/login?returnTo=/fr/espace-client", { maxRedirects: 0 });
    expect(fr.headers()["location"]).toMatch(/\/fr\/connexion\?returnTo=%2Ffr%2Fespace-client$/);
    const en = await request.get("/api/auth/login?returnTo=/en/account", { maxRedirects: 0 });
    expect(en.headers()["location"]).toMatch(/\/en\/sign-in\?returnTo=%2Fen%2Faccount$/);
    // Never an open redirect.
    const evil = await request.get("/api/auth/login?returnTo=//evil.example.com", { maxRedirects: 0 });
    expect(evil.headers()["location"]).toMatch(/\/fr\/connexion$/);
  });

  test("a forged session cookie does not open the client area", async ({ page, context, baseURL }) => {
    // A cookie is present, so the proxy lets the request through: the page itself must
    // reject the invalid session (the API answers 401) and send the visitor to sign-in.
    await context.addCookies([{ name: "d4i_session", value: "forged-value", url: baseURL! }]);
    await page.goto("/fr/espace-client");

    await expect(page).toHaveURL(/\/fr\/connexion\?returnTo=%2Ffr%2Fespace-client$/);
    await expect(page.getByText("Mes organisations")).toHaveCount(0);
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
    await expect(page.getByRole("link", { name: "Espace client" })).toHaveAttribute("href", "/fr/espace-client");
    await page.goto("/en");
    await expect(page.getByRole("link", { name: "Client area" })).toHaveAttribute("href", "/en/account");
  });
});

test.describe("accounts", () => {
  test("sign up, sign out, sign in again and change the password", async ({ page, context }) => {
    const email = `alice+${Date.now()}@example.com`;

    // A protected page leads to sign-in, then to sign-up, keeping the page to come back to.
    await page.goto("/fr/espace-client");
    await expect(page).toHaveURL(/\/fr\/connexion\?returnTo=/);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(audit.violations.map((v) => v.id)).toEqual([]);
    await page.getByRole("link", { name: "Créer un compte" }).click();
    await expect(page).toHaveURL(/\/fr\/inscription\?returnTo=/);

    // Checked before anything is sent.
    await page.getByRole("button", { name: "Créer mon compte" }).filter({ visible: true }).click();
    await expect(page.getByLabel(/Nom complet/).filter({ visible: true })).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel(/Nom complet/).filter({ visible: true }).fill("Alice Martin");
    await page.getByLabel(/Adresse e-mail/).filter({ visible: true }).fill(email);
    await page.getByLabel(/^Mot de passe/).filter({ visible: true }).fill(PASSWORD);
    await page.getByLabel(/Confirmez le mot de passe/).filter({ visible: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Créer mon compte" }).filter({ visible: true }).click();

    await expect(page).toHaveURL(/\/fr\/espace-client$/);
    await expect(page.getByText(email)).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === "d4i_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    await page.getByRole("button", { name: "Se déconnecter" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/fr$/);
    expect((await context.cookies()).some((c) => c.name === "d4i_session")).toBe(false);

    // Wrong password: one message, whatever was wrong.
    await page.goto("/fr/connexion");
    await page.getByLabel(/Adresse e-mail/).filter({ visible: true }).fill(email);
    await page.getByLabel(/Mot de passe/).filter({ visible: true }).fill("not the password");
    await page.getByRole("button", { name: "Se connecter" }).filter({ visible: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Adresse e-mail ou mot de passe incorrect." })).toBeVisible();

    await page.getByLabel(/Mot de passe/).filter({ visible: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/fr\/espace-client$/);

    // Password change.
    await page.getByRole("link", { name: "Mot de passe" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Changer mon mot de passe" })).toBeVisible();
    await page.getByLabel(/Mot de passe actuel/).filter({ visible: true }).fill("not it at all");
    await page.getByLabel(/Nouveau mot de passe/).filter({ visible: true }).fill("another long passphrase");
    await page.getByLabel(/Confirmez le mot de passe/).filter({ visible: true }).fill("another long passphrase");
    await page.getByRole("button", { name: "Changer le mot de passe" }).filter({ visible: true }).click();
    await expect(page.getByLabel(/Mot de passe actuel/).filter({ visible: true })).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel(/Mot de passe actuel/).filter({ visible: true }).fill(PASSWORD);
    await page.getByLabel(/Nouveau mot de passe/).filter({ visible: true }).fill("another long passphrase");
    await page.getByLabel(/Confirmez le mot de passe/).filter({ visible: true }).fill("another long passphrase");
    await page.getByRole("button", { name: "Changer le mot de passe" }).filter({ visible: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Mot de passe changé" })).toBeVisible();
  });

  test("an email has one account", async ({ page }) => {
    const email = `bob+${Date.now()}@example.com`;
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto("/en/sign-up");
      await page.getByLabel(/Full name/).filter({ visible: true }).fill("Bob");
      await page.getByLabel(/Email address/).filter({ visible: true }).fill(email);
      await page.getByLabel(/^Password/).filter({ visible: true }).fill(PASSWORD);
      await page.getByLabel(/Confirm the password/).filter({ visible: true }).fill(PASSWORD);
      await page.getByRole("button", { name: "Create my account" }).filter({ visible: true }).click();
      if (attempt === 0) {
        await expect(page).toHaveURL(/\/en\/account$/);
        await page.context().clearCookies();
      }
    }
    await expect(page.getByText("An account already uses this address. Sign in instead.")).toBeVisible();
  });
});
