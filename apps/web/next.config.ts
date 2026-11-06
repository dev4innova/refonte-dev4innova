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
};

export default withNextIntl(nextConfig);
