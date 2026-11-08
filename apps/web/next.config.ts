import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server bundle for the Docker image (infra/docker/web.Dockerfile).
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  // Workspace packages are shipped as TypeScript sources.
  transpilePackages: ["@dev4innova/api-client"],
  poweredByHeader: false,
  experimental: {
    // Uploads go through Server Actions: back-office images (5 MB) and documents for the
    // AI analyzer (10 MB), files of the client portal (25 MB), plus multipart overhead.
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default withNextIntl(nextConfig);
