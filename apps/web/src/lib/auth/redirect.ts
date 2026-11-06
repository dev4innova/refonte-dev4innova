import "server-only";

// The sign-in route is not a localized page, so next-intl's redirect does not apply here.
// eslint-disable-next-line no-restricted-imports
import { redirect } from "next/navigation";

import { sanitizeReturnTo } from "./return-to";

/** Sends the user to sign-in, then back to `returnTo` (a same-site path). */
export function redirectToLogin(returnTo: string): never {
  redirect(`/api/auth/login?returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo))}`);
}
