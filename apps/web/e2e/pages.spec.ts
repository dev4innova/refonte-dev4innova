import { expect, test } from "@playwright/test";

/*
 * Corporate website pages (EPIC 05): every page answers in both languages, with one <h1>,
 * a page-specific title, a description and hreflang alternates (TASK-056).
 */
const PAGES: { fr: string; en: string }[] = [
  { fr: "/fr", en: "/en" },
  { fr: "/fr/solutions", en: "/en/solutions" },
  { fr: "/fr/solutions/ai-assistants", en: "/en/solutions/ai-assistants" },
  { fr: "/fr/services", en: "/en/services" },
  { fr: "/fr/services/ai-strategy", en: "/en/services/ai-strategy" },
  { fr: "/fr/a-propos", en: "/en/about" },
  { fr: "/fr/innovation-lab", en: "/en/innovation-lab" },
  { fr: "/fr/academy", en: "/en/academy" },
  { fr: "/fr/portfolio", en: "/en/portfolio" },
  { fr: "/fr/insights", en: "/en/insights" },
  { fr: "/fr/contact", en: "/en/contact" },
  { fr: "/fr/devis", en: "/en/quote" },
  { fr: "/fr/diagnostic-ia", en: "/en/ai-diagnostic" },
];

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "content checks are viewport-independent");
});

for (const { fr, en } of PAGES) {
  test(`${fr} and ${en} are complete pages`, async ({ page }) => {
    const titles: string[] = [];
    for (const [path, lang] of [
      [fr, "fr"],
      [en, "en"],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
      await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute("href", new RegExp(`${fr}$`));
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", new RegExp(`${en}$`));
      titles.push(
        (await page.locator('meta[name="description"]').getAttribute("content")) ?? "",
      );
    }
    // Titles may be identical (proper nouns such as "Portfolio"); descriptions are translated.
    expect(titles[0]).not.toBe(titles[1]);
  });
}

test("unknown solution and service slugs show the not-found page, never indexed", async ({ page }) => {
  // With Cache Components, a param outside generateStaticParams is rendered on demand:
  // notFound() then streams the 404 page with a noindex tag (status 200 once streaming started).
  for (const [path, heading] of [
    ["/fr/solutions/unknown", "Cette page est introuvable"],
    ["/en/services/unknown", "This page could not be found"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  }
});

test("cards lead to the detail pages", async ({ page }) => {
  await page.goto("/fr/solutions");
  await page.getByRole("link", { name: "Automatisation documentaire" }).click();
  await expect(page).toHaveURL(/\/fr\/solutions\/document-automation$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Automatisation documentaire");
  await page
    .getByRole("navigation", { name: "Fil d'Ariane" })
    .getByRole("link", { name: "Solutions" })
    .click();
  await expect(page).toHaveURL(/\/fr\/solutions$/);
});

test("the homepage declares the organization (JSON-LD)", async ({ page }) => {
  await page.goto("/fr");
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(json ?? "{}")).toMatchObject({ "@type": "Organization", name: "DEV4INNOVA" });
});

test("sitemap lists every public page in both languages", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const { fr, en } of PAGES) {
    expect(xml, fr).toContain(`${fr}</loc>`);
    expect(xml, en).toContain(`${en}</loc>`);
  }
  expect(xml).not.toContain("espace-client");
  expect(xml).not.toContain("design-system");
  expect(xml).toContain('hreflang="en"');
});

test("robots.txt blocks indexing outside production and points to the sitemap", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/\s/);
  expect(robots).toContain("Sitemap:");
});
