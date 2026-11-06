import { expect, test } from "@playwright/test";

/*
 * Multilingual navigation (TASK-037): locale detection, prefixes, localized pathnames,
 * language switcher, persistence of the choice, lang/hreflang and localized 404.
 * Runs once (desktop project): the behaviour does not depend on the viewport.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "locale behaviour is viewport-independent");
});

test.describe("locale detection", () => {
  test.use({ locale: "en-US" });

  test("redirects / to the browser language", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("default locale", () => {
  test.use({ locale: "de-DE" });

  test("falls back to French for unsupported languages", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("prefixes unprefixed paths with the locale", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page).toHaveURL(/\/fr\/design-system$/);
  });
});

test.describe("translated pages", () => {
  test("French and English pages show their own copy", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("L'intégrateur de solutions IA");
    await expect(page).toHaveTitle("DEV4INNOVA — L'intégrateur de solutions IA");

    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The AI solutions integrator");
    await expect(page).toHaveTitle("DEV4INNOVA — The AI solutions integrator");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeAttached();
  });

  test("links use localized pathnames", async ({ page }) => {
    await page.goto("/fr");
    const frFooter = page.getByRole("contentinfo");
    await expect(frFooter.getByRole("link", { name: "À propos" })).toHaveAttribute("href", "/fr/a-propos");
    await expect(frFooter.getByRole("link", { name: "Mentions légales" })).toHaveAttribute(
      "href",
      "/fr/mentions-legales",
    );

    await page.goto("/en");
    const enFooter = page.getByRole("contentinfo");
    await expect(enFooter.getByRole("link", { name: "About" })).toHaveAttribute("href", "/en/about");
    await expect(enFooter.getByRole("link", { name: "Legal notice" })).toHaveAttribute(
      "href",
      "/en/legal-notice",
    );
  });

  test("localized pathnames are rewritten in place, without redirect loop", async ({ request }) => {
    // /fr/a-propos and /en/about map to the same internal route, which has no page yet
    // (EPIC 05): a 404 proves the rewrite stayed internal instead of redirecting.
    for (const path of ["/fr/a-propos", "/en/about", "/fr/mentions-legales"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }
  });

  test("declares hreflang alternates and a canonical URL", async ({ page }) => {
    await page.goto("/fr/design-system");
    const alternate = (lang: string) => page.locator(`link[rel="alternate"][hreflang="${lang}"]`);

    await expect(alternate("fr")).toHaveAttribute("href", /\/fr\/design-system$/);
    await expect(alternate("en")).toHaveAttribute("href", /\/en\/design-system$/);
    await expect(alternate("x-default")).toHaveAttribute("href", /\/fr\/design-system$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fr\/design-system$/);
  });
});

test.describe("language switcher", () => {
  test("switches language on the same page and remembers the choice", async ({ page }) => {
    await page.goto("/fr/design-system");
    const switcher = page.getByRole("navigation", { name: "Langue" });
    await expect(switcher.getByRole("link", { name: "Français" })).toHaveAttribute("aria-current", "true");

    await switcher.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/design-system$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("DEV4INNOVA design system");
    await expect(
      page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "English" }),
    ).toHaveAttribute("aria-current", "true");

    // The NEXT_LOCALE cookie now wins over the browser language.
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });

  test("is reachable and usable with the keyboard", async ({ page }) => {
    await page.goto("/en");
    const french = page.getByRole("navigation", { name: "Language" }).getByRole("link", {
      name: "Français",
    });
    await french.focus();
    await expect(french).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/fr$/);
  });
});

test.describe("not found", () => {
  test("unknown pages render a localized 404", async ({ page }) => {
    const fr = await page.goto("/fr/page-inexistante");
    expect(fr?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cette page est introuvable");

    const en = await page.goto("/en/missing-page");
    expect(en?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page could not be found");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
