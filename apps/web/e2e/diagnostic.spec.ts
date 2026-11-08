import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/*
 * AI diagnostic (TASK-089 → TASK-095), against the running API. The CI API has no AI provider
 * key: the analysis must fail gracefully, the rest of the report stays available.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered on mobile and desktop");
});

test("answering every question leads to a scored result, then to the full report", async ({ page }, testInfo) => {
  await page.goto("/fr/diagnostic-ia");
  await expect(page.getByText("Étape 1 sur 6")).toBeVisible();
  await page.getByLabel("Secteur d'activité").selectOption("industry");
  await page.getByRole("button", { name: "Suivant" }).click();

  await expect(page.getByRole("heading", { name: "Stratégie et cas d'usage" })).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("4 questions restent sans réponse.")).toBeVisible();

  for (let step = 0; step < 5; step++) {
    const groups = page.locator("fieldset");
    await expect(groups.first()).toBeVisible();
    const count = await groups.count();
    for (let i = 0; i < count; i++) await groups.nth(i).getByRole("radio").nth(2).check();
    await page.getByRole("button", { name: step === 4 ? "Voir mon résultat" : "Suivant" }).click();
  }

  await expect(page).toHaveURL(/\/fr\/diagnostic-ia\/resultat\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Votre maturité IA" })).toBeVisible();
  await expect(page.getByText("67", { exact: true }).first()).toBeVisible();

  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);

  // The unlock form is checked before anything is sent.
  await page.getByRole("button", { name: "Obtenir mon rapport" }).click();
  await expect(page.getByLabel(/Adresse e-mail/)).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel(/Nom complet/).fill("Camille Durand");
  await page.getByLabel(/Adresse e-mail/).fill(`camille+${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel(/Organisation/).fill("Globex");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Obtenir mon rapport" }).click();

  await expect(page.getByRole("heading", { name: "Votre rapport complet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Télécharger le PDF" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Analyse personnalisée" })).toBeVisible();
});

test("an unknown result link shows a not-found page", async ({ page }) => {
  // Streamed: the status is 200 once streaming started, the 404 page is noindex.
  await page.goto("/en/ai-diagnostic/result/this-token-does-not-exist-at-all-x");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page could not be found");
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
});

test("the report relay refuses malformed tokens", async ({ request }) => {
  expect((await request.get("/api/diagnostic/..%2Fadmin/report")).status()).toBe(404);
  expect((await request.get("/api/diagnostic/short/report")).status()).toBe(404);
});

test("the staff list of diagnostics requires a session", async ({ page }) => {
  await page.goto("/fr/admin/crm/diagnostics");
  await expect(page).not.toHaveURL(/\/admin\/crm\/diagnostics$/);
});
