import { routing, type AppPathname } from "@/i18n/routing";

/** Internal pathnames that require a signed-in user (TASK-044). */
export const PROTECTED_PATHNAMES: AppPathname[] = ["/account"];

function localizedPrefixes(): string[] {
  return PROTECTED_PATHNAMES.flatMap((pathname) => {
    const config = routing.pathnames[pathname];
    return routing.locales.map((locale) => {
      const localized = typeof config === "string" ? config : config[locale];
      return `/${locale}${localized}`;
    });
  });
}

const PREFIXES = localizedPrefixes();

/** True for a public URL (e.g. `/fr/espace-client/...`) under a protected pathname. */
export function isProtectedPath(pathname: string): boolean {
  return PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
