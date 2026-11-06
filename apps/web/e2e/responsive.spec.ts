import { expect, test } from "@playwright/test";

const PAGES = ["/fr", "/fr/design-system", "/en"];
const NAV = "Navigation principale";

test.describe("responsive layout", () => {
  for (const path of PAGES) {
    test(`${path} has no horizontal scroll`, async ({ page }, testInfo) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await testInfo.attach(`${testInfo.project.name}${path.replace(/\//g, "-") || "-home"}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    });
  }

  test("shows the desktop navigation or the burger menu depending on the width", async ({
    page,
  }, testInfo) => {
    await page.goto("/fr");
    const desktopNav = page.getByRole("banner").getByRole("navigation", { name: NAV });
    const burger = page.getByRole("button", { name: "Ouvrir le menu" });

    if (testInfo.project.name === "desktop") {
      await expect(desktopNav).toBeVisible();
      await expect(burger).toBeHidden();
    } else {
      await expect(desktopNav).toBeHidden();
      await expect(burger).toBeVisible();
    }
  });

  test("the mobile menu opens, traps focus and closes with Escape", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "burger menu is hidden on desktop");
    await page.goto("/fr");
    const burger = page.getByRole("button", { name: "Ouvrir le menu" });

    await burger.click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Solutions" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Nous contacter" })).toBeVisible();

    for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(burger).toBeFocused();
  });

  test("the skip link is the first focusable element and targets the main content", async ({
    page,
  }) => {
    await page.goto("/fr");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu principal" });

    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("buttons and links are large enough to tap", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "touch targets matter on mobile");
    await page.goto("/fr");
    for (const target of [
      page.getByRole("button", { name: "Ouvrir le menu" }),
      page.getByRole("link", { name: "Nous contacter" }).first(),
    ]) {
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("animations are effectively disabled", async ({ page }) => {
    await page.goto("/fr/design-system");
    const duration = await page
      .locator(".animate-fade-in")
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });
});
