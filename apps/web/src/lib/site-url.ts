/**
 * Public origin of the website, used for canonical and hreflang URLs.
 * Set SITE_URL in each environment (e.g. https://www.dev4innova.com).
 */
export function getSiteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:3000";
}
