import { expect, test } from "@playwright/test";

/* Homepage of the Creative Tech Studio redesign (doc 04): structure, links, motion and
 * performance budget (doc 08: LCP ≤ 1 s and CLS ≤ 0.02 locally). */

const SECTIONS_FR = [
  "Une seule équipe, de l'idée à la production",
  "Évaluez votre maturité IA en 5 minutes",
  "Des briques éprouvées, adaptées à votre métier",
  "Ce que nous avons construit",
  "Un accompagnement de bout en bout",
  "Une méthode itérative qui livre de la valeur rapidement",
  "Nos engagements",
  "Tester avant d'investir",
  "Former vos équipes à l'IA",
];

test("sections follow the reading order of doc 04, under a single h1", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("L'intégrateur de solutions IA");
  const headings = page.getByRole("main").getByRole("heading", { level: 2 });
  // Accessible names (the decorative section index is hidden). Optional CMS sections
  // (articles) may sit before the contact panel.
  for (const [index, title] of SECTIONS_FR.entries()) {
    await expect(headings.nth(index)).toHaveAccessibleName(title);
  }
  await expect(headings.last()).toHaveAccessibleName("Un projet d'intelligence artificielle ?");
});

test("the hero leads to the contact form and to the diagnostic", async ({ page }) => {
  await page.goto("/fr");
  const hero = page.getByRole("region", { name: "L'intégrateur de solutions IA" });
  await expect(hero.getByRole("link", { name: "Parler de votre projet" })).toHaveAttribute("href", "/fr/contact");
  await expect(hero.getByRole("link", { name: "Faire le diagnostic IA" })).toHaveAttribute(
    "href",
    "/fr/diagnostic-ia",
  );
});

test("each solution of the bento grid leads to its page", async ({ page }) => {
  await page.goto("/en");
  const solutions = page.getByRole("region", { name: "Proven building blocks, fitted to your business" });
  const links = solutions.getByRole("listitem").getByRole("link");
  await expect(links).toHaveCount(5);
  await links.first().click();
  await expect(page).toHaveURL(/\/en\/solutions\/ai-assistants$/);
});

test("the example radar is captioned as such, not as client data", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.getByText("Exemple de résultat : valeurs d'illustration, pas une donnée client")).toBeVisible();
});

test("services come from the CMS as an editorial list", async ({ page }) => {
  await page.goto("/fr");
  const services = page.getByRole("region", { name: "Un accompagnement de bout en bout" });
  const list = services.locator("[data-slot=services-list]");
  await expect(list.getByRole("link").first()).toHaveAttribute("href", /^\/fr\/services\//);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing is hidden and the filament is drawn at once", async ({ page }) => {
    await page.goto("/fr");
    await page.mouse.wheel(0, 4000);
    await expect(page.locator('[data-reveal="hidden"]')).toHaveCount(0);
    const draw = page.locator(".illu-draw").first();
    expect(await draw.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});

test("stays within the performance budget (LCP and CLS)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "measured once, on desktop");
  await page.goto("/fr", { waitUntil: "networkidle" });
  const { lcp, cls } = await page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
            if (!entry.hadRecentInput) cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve({ lcp, cls }), 1500);
      }),
  );
  await testInfo.attach("web-vitals", { body: JSON.stringify({ lcp, cls }), contentType: "application/json" });
  expect(lcp).toBeLessThanOrEqual(1000);
  expect(cls).toBeLessThanOrEqual(0.02);
});
