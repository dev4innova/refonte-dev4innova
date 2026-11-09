import { expect, test } from "@playwright/test";

/*
 * Academy (EPIC 12). CI has no identity provider and no course: the full learning flow is
 * covered by the API tests and checked manually; here, the public pages and access control.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered on mobile and desktop");
});

test("the Academy page lists the open courses, or says they are coming", async ({ page }) => {
  await page.goto("/fr/academy");
  const catalog = page.getByRole("region", { name: "Catalogue des formations" });
  await expect(catalog).toBeVisible();
  await expect(
    catalog.getByText("Les premières formations en ligne arrivent bientôt.").or(catalog.getByRole("link", { name: /Voir la formation/ }).first()),
  ).toBeVisible();
});

test("an unknown course shows the not-found page", async ({ page }) => {
  await page.goto("/en/academy/this-course-does-not-exist");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page could not be found");
});

test("an unknown certificate code is reported, never indexed", async ({ page }) => {
  await page.goto("/fr/academy/certificat/D4I-AAAA-BBBB-CCCC");
  await expect(page.getByText("Aucun certificat ne correspond à ce code. Vérifiez sa saisie.")).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
});

test("the learner area and the Academy back office require a session", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "routing behaviour is viewport-independent");
  for (const [path, encoded] of [
    ["/fr/espace-client/formations", "%2Ffr%2Fespace-client%2Fformations"],
    ["/en/account/academy/some-course", "%2Fen%2Faccount%2Facademy%2Fsome-course"],
    ["/fr/admin/academy", "%2Ffr%2Fadmin%2Facademy"],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(new RegExp(`/api/auth/login\\?returnTo=${encoded}$`));
  }
});

test("the certificate PDF route only accepts certificate codes", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "routing behaviour is viewport-independent");
  expect((await request.get("/api/academy/certificates/..%2Fadmin")).status()).toBe(404);
  expect((await request.get("/api/academy/certificates/D4I-AAAA-BBBB-CCCC")).status()).toBe(404);
});
