import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/*
 * Baseline security headers on every response (TASK-123). No full Content-Security-Policy yet:
 * Next inline scripts, video embeds and Sentry would need nonces; frame-ancestors still
 * forbids framing the site (clickjacking). HSTS is ignored by browsers over plain HTTP.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server bundle for the Docker image (infra/docker/web.Dockerfile).
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  // Workspace packages are shipped as TypeScript sources.
  transpilePackages: ["@dev4innova/api-client"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Uploads go through Server Actions: back-office images (5 MB) and documents for the
    // AI analyzer (10 MB), files of the client portal (25 MB), plus multipart overhead.
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default withNextIntl(nextConfig);
