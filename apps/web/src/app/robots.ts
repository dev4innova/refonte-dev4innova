import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

/** /robots.txt (TASK-056). Indexing only when ALLOW_INDEXING=true (production): staging stays hidden. */
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  const production = process.env.ALLOW_INDEXING === "true";

  return {
    rules: production
      ? {
          userAgent: "*",
          allow: "/",
          disallow: ["/api/", "/fr/espace-client", "/en/account", "/fr/design-system", "/en/design-system"],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${site}/sitemap.xml`,
  };
}
