import { headers } from "next/headers";

/**
 * Forwards the visitor's address to the API, which rate-limits public forms per visitor
 * (the API only trusts it with TRUST_FORWARDED_FOR, behind the web app).
 */
export async function forwardedForHeader(): Promise<Record<string, string>> {
  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    undefined;
  return clientIp ? { "X-Forwarded-For": clientIp } : {};
}

/** Maps an API validation error (`details.errors[].loc`) to the given form fields. */
export function fieldsFromApiError<F extends string>(error: unknown, fields: readonly F[]): F[] {
  const errors = (error as { error?: { details?: { errors?: { loc?: unknown[] }[] } } })?.error
    ?.details?.errors;
  if (!Array.isArray(errors)) return [];
  const found = errors
    .map((e) => (Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : undefined))
    .filter((key): key is F => fields.includes(key as F));
  return [...new Set(found)];
}
