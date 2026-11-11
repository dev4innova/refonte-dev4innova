import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/*
 * Real-browser accessibility audit (WCAG 2.2 A/AA), including color contrast,
 * which jsdom-based unit tests cannot check.
 */
const PAGES = [
  "/fr",
  "/en",
  "/fr/design-system",
  "/fr/solutions",
  "/fr/solutions/ai-assistants",
  "/fr/services",
  "/en/services/run-and-improve",
  "/fr/a-propos",
  "/fr/innovation-lab",
  "/fr/academy",
  "/fr/portfolio",
  "/en/insights",
  "/fr/contact",
  "/fr/mentions-legales",
  "/fr/devis",
  "/fr/diagnostic-ia",
];

for (const path of PAGES) {
  test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    // Let entrance animations finish so contrast is measured on final colors.
    await page.waitForTimeout(600);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}

test("the open mobile menu has no WCAG 2.2 AA violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "burger menu is hidden on desktop");
  await page.goto("/fr");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(600);

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
