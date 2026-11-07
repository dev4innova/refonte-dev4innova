import { expect, test } from "@playwright/test";

/*
 * Quote request (TASK-072), against the running API: the request is stored in the CRM as a
 * prospect with an opportunity (checked by the API tests).
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered on mobile and desktop");
});

test("a service page leads to the quote form with the service chosen", async ({ page }) => {
  await page.goto("/fr/services/custom-development");
  await page.locator("main").getByRole("link", { name: "Demander un devis" }).click();
  await expect(page).toHaveURL(/\/fr\/devis\?service=custom-development$/);
  await expect(page.getByRole("combobox", { name: "Service concerné" })).toHaveValue("custom-development");
});

test("a valid quote request is sent and confirmed", async ({ page }, testInfo) => {
  await page.goto("/en/quote");
  await page.getByRole("textbox", { name: /Full name/ }).fill("Dominique Martin");
  await page
    .getByRole("textbox", { name: /Work email address/ })
    .fill(`dominique+${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByRole("textbox", { name: /Organization/ }).fill("Globex");
  await page.getByRole("combobox", { name: "Related service" }).selectOption("ai-strategy");
  await page
    .getByRole("textbox", { name: /Your needs/ })
    .fill("An assistant answering our customers' questions about their contracts.");
  await page.getByRole("combobox", { name: "Indicative budget" }).selectOption("30k_100k");
  await page.getByRole("combobox", { name: "Desired timeline" }).selectOption("within_3_months");
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Send the request" }).click();

  await expect(
    page.getByRole("heading", { name: "Thank you, your quote request has been sent" }),
  ).toBeVisible();
});

test("server-side validation explains each error and keeps the choices", async ({ page }) => {
  await page.goto("/fr/devis");
  await page.getByRole("combobox", { name: "Délai souhaité" }).selectOption("asap");
  await page.getByRole("button", { name: "Envoyer la demande" }).click();

  const summary = page.getByText("Le formulaire contient des erreurs.");
  await expect(summary).toBeFocused();
  await expect(page.getByRole("textbox", { name: /Votre besoin/ })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("combobox", { name: "Délai souhaité" })).toHaveValue("asap");
});
