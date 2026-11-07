import { expect, test } from "@playwright/test";

/*
 * Contact form (TASK-055, TASK-057), against the running API (stored in PostgreSQL).
 * Errors that keep what the visitor typed (API unavailable, rate limit) are covered by the
 * unit tests (actions.test.ts, contact-form.test.tsx).
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered on mobile and desktop");
});

test("server-side validation explains each error", async ({ page }) => {
  await page.goto("/fr/contact");
  await page.getByRole("button", { name: "Envoyer le message" }).click();

  const summary = page.getByText("Le formulaire contient des erreurs.");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(page.getByRole("textbox", { name: /Nom complet/ })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Votre accord est nécessaire pour que nous puissions vous répondre.")).toBeVisible();
});

test("a valid message is stored and confirmed", async ({ page }, testInfo) => {
  await page.goto("/en/contact");
  await page.getByRole("textbox", { name: /Full name/ }).fill("Camille Durand");
  await page.getByRole("textbox", { name: /Work email address/ }).fill(`camille+${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByRole("combobox", { name: "Subject" }).selectOption("training");
  await page
    .getByRole("textbox", { name: /Your message/ })
    .fill("We would like to train our teams in generative AI.");
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(
    page.getByRole("heading", { name: "Thank you, your message has been sent" }),
  ).toBeVisible();
});

test("the honeypot is invisible", async ({ page }) => {
  await page.goto("/fr/contact");
  await expect(page.locator('input[name="website"]')).not.toBeInViewport();
});
