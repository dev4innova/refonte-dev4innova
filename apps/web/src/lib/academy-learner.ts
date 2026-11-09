import "server-only";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireSession } from "@/lib/admin";
import { serverApi } from "@/lib/api";

type Href = Parameters<typeof getPathname>[0]["href"];

/** API client of the signed-in learner, or a redirect to sign-in back to this page. */
export async function learnerApi(locale: Locale, href: Href) {
  const session = await requireSession(getPathname({ locale, href }));
  return serverApi(session.accessToken);
}
