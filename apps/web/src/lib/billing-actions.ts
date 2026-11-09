import "server-only";

import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { isCheckoutUrl } from "@/lib/billing";

/* Shared plumbing of the billing Server Actions. */

export type BillingError =
  | "signin"
  | "forbidden"
  | "notFound"
  | "profile"
  | "expired"
  | "code"
  | "conflict"
  | "payment"
  | "validation"
  | "generic";

export type BillingResult<T = undefined> = { ok: true; data: T } | { ok: false; error: BillingError };

type ApiError = { error?: { code?: string; details?: Record<string, unknown> } } | undefined;

export function errorFrom(status: number, body: unknown): BillingResult<never> {
  const error = (body as ApiError)?.error;
  if (status === 401) return { ok: false, error: "signin" };
  if (status === 403) return { ok: false, error: "forbidden" };
  if (status === 404) return { ok: false, error: "notFound" };
  if (status === 409) {
    if (error?.code === "billing_profile_required") return { ok: false, error: "profile" };
    if (error?.details?.reason === "expired") return { ok: false, error: "expired" };
    if (error?.details?.field === "code") return { ok: false, error: "code" };
    return { ok: false, error: "conflict" };
  }
  if (status === 422) return { ok: false, error: "validation" };
  if (status === 503) return { ok: false, error: "payment" };
  return { ok: false, error: "generic" };
}

export const SIGNIN: BillingResult<never> = { ok: false, error: "signin" };
export const DONE: BillingResult = { ok: true, data: undefined };

export async function api() {
  const session = await getSession();
  return session ? serverApi(session.accessToken) : null;
}

/** A Checkout URL from the API, checked before the browser is sent there. */
export function checkoutResult(data: { url: string } | undefined, status: number, error: unknown): BillingResult<{ url: string }> {
  if (!data) return errorFrom(status, error);
  return isCheckoutUrl(data.url) ? { ok: true, data: { url: data.url } } : { ok: false, error: "payment" };
}
