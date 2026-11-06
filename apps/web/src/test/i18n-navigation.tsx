import type * as React from "react";

/**
 * Test double for `@/i18n/navigation`: a plain <a> that shows the target locale and
 * pathname (`/fr/about`), and a controllable internal pathname.
 */
export function mockI18nNavigation(getPathname: () => string, locale = "fr") {
  function Link({
    href,
    locale: targetLocale,
    ...props
  }: Omit<React.ComponentProps<"a">, "href"> & {
    href: string | { pathname: string };
    locale?: string;
  }) {
    const pathname = typeof href === "string" ? href : href.pathname;
    return <a href={`/${targetLocale ?? locale}${pathname === "/" ? "" : pathname}`} {...props} />;
  }
  return {
    Link,
    usePathname: getPathname,
    useRouter: () => ({ push: () => {}, replace: () => {} }),
    getPathname: ({ href }: { href: string }) => href,
    redirect: () => {},
  };
}
