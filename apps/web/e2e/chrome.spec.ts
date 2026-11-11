import { expect, test } from "@playwright/test";

/* Site chrome of the Creative Tech Studio redesign: header (overlay variant, active link,
 * narrow phones) and footer (contact routes). Run once, on the desktop project. */

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "viewports are set by each test");
});

for (const width of [320, 1920]) {
  test(`no horizontal scroll at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/fr", "/en", "/fr/contact", "/fr/design-system"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}

test("the header turns graphite over a dark hero, ivory otherwise", async ({ page }) => {
  await page.goto("/fr");
  const header = page.getByRole("banner");
  const background = () => header.evaluate((el) => getComputedStyle(el).backgroundColor);
  const light = await background();

  // A page opts in by marking its hero; the header follows with CSS only.
  await page.evaluate(() => {
    const hero = document.createElement("div");
    hero.setAttribute("data-header-overlay", "");
    document.querySelector("main")?.prepend(hero);
  });
  const dark = await background();
  expect(dark).not.toBe(light);
  // Graphite #141417, translucent.
  expect(dark).toMatch(/^(oklab|rgba?|color)\(/);
  // The header scope swaps the semantic tokens: ivory text, light red focus ring.
  const tokens = await header.evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.getPropertyValue("--foreground"), style.getPropertyValue("--ring")].map((v) =>
      v.trim().toLowerCase(),
    );
  });
  expect(tokens).toEqual(["#f7f7f5", "#ff4757"]);
  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBackground).toBe("rgb(20, 20, 23)");
});

test("the active section is marked in the navigation", async ({ page }) => {
  await page.goto("/fr/solutions/ai-assistants");
  const link = page
    .getByRole("banner")
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Solutions" });
  await expect(link).toHaveAttribute("aria-current", "page");
});

test("the footer recalls the contact and the diagnostic", async ({ page }) => {
  await page.goto("/en");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("heading", { level: 2, name: "A project, a question?" })).toBeVisible();
  await footer.getByRole("link", { name: "Start with the diagnostic" }).click();
  await expect(page).toHaveURL(/\/en\/ai-diagnostic$/);
});
