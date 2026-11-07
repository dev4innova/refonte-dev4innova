import { expect, test } from "@playwright/test";

/*
 * Content served by the CMS (EPIC 06). The API runs with its migrations, which seed the
 * five services; the back office is behind sign-in like the client area.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "content checks are viewport-independent");
});

const SERVICES = [
  "ai-strategy",
  "custom-development",
  "integration-deployment",
  "training-support",
  "run-and-improve",
];

test("the services come from the CMS, in order, on the services page and the homepage", async ({
  page,
}) => {
  for (const path of ["/fr/services", "/fr"]) {
    await page.goto(path);
    const links = page.locator('main a[href*="/fr/services/"]');
    // The list streams in (Suspense): wait for it before reading every link.
    await expect(links.first()).toBeVisible();
    const hrefs = await links.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href")),
    );
    const slugs = [...new Set(hrefs.map((href) => href?.split("/").pop()))];
    expect(slugs, path).toEqual(SERVICES);
  }
});

test("a service page renders its Markdown body and switches language", async ({ page }) => {
  await page.goto("/fr/services/ai-strategy");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".prose-d4i h2").first()).toBeVisible();

  const english = page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: "English" });
  await expect(english).toHaveAttribute("href", "/en/services/ai-strategy");
  await english.click();
  await expect(page).toHaveURL(/\/en\/services\/ai-strategy$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the sitemap lists the services published in the CMS", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const slug of SERVICES) {
    expect(xml).toContain(`/fr/services/${slug}</loc>`);
    expect(xml).toContain(`/en/services/${slug}</loc>`);
  }
});

test.describe("back office", () => {
  for (const [path, encoded] of [
    ["/fr/admin", "%2Ffr%2Fadmin"],
    ["/en/admin/content/article", "%2Fen%2Fadmin%2Fcontent%2Farticle"],
    ["/fr/admin/media", "%2Ffr%2Fadmin%2Fmedia"],
    ["/fr/admin/crm", "%2Ffr%2Fadmin%2Fcrm"],
    ["/en/admin/crm/leads", "%2Fen%2Fadmin%2Fcrm%2Fleads"],
    ["/fr/admin/ai", "%2Ffr%2Fadmin%2Fai"],
    ["/en/admin/ai/playground", "%2Fen%2Fadmin%2Fai%2Fplayground"],
    [
      "/fr/espace-client/ia/11111111-2222-4333-8444-555555555555",
      "%2Ffr%2Fespace-client%2Fia%2F11111111-2222-4333-8444-555555555555",
    ],
  ] as const) {
    test(`${path} sends anonymous visitors to sign-in`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toMatch(
        new RegExp(`/api/auth/login\\?returnTo=${encoded}$`),
      );
    });
  }

  test("the AI playground stream refuses other sites and anonymous visitors", async ({ request }) => {
    const url = "/api/admin/ai/playground";
    const data = { message: "Bonjour" };
    const crossSite = await request.post(url, { data, headers: { Origin: "https://evil.example" } });
    expect(crossSite.status()).toBe(403);
    // The site's own origin (SITE_URL, as in the build).
    const site = new URL(process.env.SITE_URL ?? "http://localhost:3000").origin;
    const anonymous = await request.post(url, { data, headers: { Origin: site } });
    expect(anonymous.status()).toBe(401);
  });

  test("the AI session stream refuses other sites and anonymous visitors", async ({ request }) => {
    const url = "/api/ai/11111111-2222-4333-8444-555555555555/sessions/66666666-7777-4888-9999-000000000000/messages";
    const data = { text: "Bonjour" };
    expect((await request.post(url, { data, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
    const site = new URL(process.env.SITE_URL ?? "http://localhost:3000").origin;
    expect((await request.post(url, { data, headers: { Origin: site } })).status()).toBe(401);
  });

  test("is never indexed nor listed in the sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).not.toContain("/admin");
  });
});
