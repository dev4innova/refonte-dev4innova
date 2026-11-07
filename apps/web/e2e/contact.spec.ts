import { expect, test } from "@playwright/test";

/*
 * Contact form (TASK-055, TASK-057). The API is not running in this suite: a valid
 * submission ends with the "unavailable" message, which also proves the server action ran.
 * The success path is covered by unit tests (actions.test.ts) and the API tests.
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

test("a valid message reaches the server and the visitor keeps what they typed", async ({ page }) => {
  await page.goto("/en/contact");
  await page.getByRole("textbox", { name: /Full name/ }).fill("Camille Durand");
  await page.getByRole("textbox", { name: /Work email address/ }).fill("camille@example.com");
  await page.getByRole("combobox", { name: "Subject" }).selectOption("training");
  await page
    .getByRole("textbox", { name: /Your message/ })
    .fill("We would like to train our teams in generative AI.");
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(
    page.getByText("The service is temporarily unavailable. Please try again later."),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Full name/ })).toHaveValue("Camille Durand");
  await expect(page.getByRole("combobox", { name: "Subject" })).toHaveValue("training");
  await expect(page.getByRole("textbox", { name: /Your message/ })).toHaveValue(
    "We would like to train our teams in generative AI.",
  );
});

test("the honeypot is invisible", async ({ page }) => {
  await page.goto("/fr/contact");
  await expect(page.locator('input[name="website"]')).not.toBeInViewport();
});
