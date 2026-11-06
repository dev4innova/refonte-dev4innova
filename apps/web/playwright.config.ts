import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

// Optional: reuse a preinstalled Chromium (e.g. in sandboxes) instead of `playwright install`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const chromium = { ...devices["Desktop Chrome"], launchOptions: { executablePath } };

/**
 * Responsive and accessibility tests (TASK-031) against the production build.
 * Run `pnpm build` first; `pnpm e2e` starts the built app.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile", use: { ...chromium, viewport: { width: 375, height: 812 } } },
    { name: "tablet", use: { ...chromium, viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { ...chromium, viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    // Same server as production: the standalone bundle (output: "standalone").
    command: "pnpm start:standalone",
    // A static asset: /api/health is 503 when no API runs, which Playwright treats as not ready.
    url: `${baseURL}/icon.svg`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      API_URL: process.env.API_URL ?? "http://127.0.0.1:8000",
    },
  },
});
