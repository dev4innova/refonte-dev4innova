import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation. Always use these instead of `next/link` / `next/navigation`
 * for internal links: they add the locale prefix and translate the pathname.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
