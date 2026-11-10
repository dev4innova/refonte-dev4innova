"use server";

// The target is a full, already localized path: next-intl's redirect does not apply.
// eslint-disable-next-line no-restricted-imports
import { redirect } from "next/navigation";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { forwardedForHeader } from "@/lib/client-ip";

import {
  type AuthFormState,
  readAuthForm,
  validatePasswordChange,
  validatePasswordReset,
  validateSignIn,
  validateSignUp,
} from "./forms";
import { sanitizeReturnTo } from "./return-to";
import { getSession, setSessionCookie } from "./session";

/*
 * Account Server Actions (ADR-0019). The browser never sees the session token: the
 * action receives it from the API and stores it in an httpOnly cookie.
 */

type ApiError = { error?: { details?: { field?: string } } } | undefined;

function failed(state: Omit<Extract<AuthFormState, { status: "error" }>, "status">): AuthFormState {
  return { status: "error", ...state };
}

function destination(locale: Locale, returnTo: string): string {
  return sanitizeReturnTo(returnTo, getPathname({ locale, href: "/account" }));
}

export async function signIn(locale: Locale, returnTo: string, _previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = readAuthForm(formData);
  const kept = { email: values.email };
  const errors = validateSignIn(values);
  if (Object.keys(errors).length) return failed({ errors, values: kept });

  let token: { token: string; expires_at: string } | undefined;
  try {
    const { data, response } = await serverApi().POST("/api/v1/auth/sign-in", {
      body: { email: values.email, password: values.password },
      headers: await forwardedForHeader(),
    });
    if (response.status === 401) return failed({ errors: {}, formError: "invalidCredentials", values: kept });
    if (response.status === 429) return failed({ errors: {}, formError: "rateLimited", values: kept });
    token = data;
  } catch {
    // Network error: handled below.
  }
  if (!token) return failed({ errors: {}, formError: "unavailable", values: kept });
  await setSessionCookie(token.token, token.expires_at);
  redirect(destination(locale, returnTo));
}

export async function signUp(locale: Locale, returnTo: string, _previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = readAuthForm(formData);
  const kept = { name: values.name, email: values.email };
  const errors = validateSignUp(values);
  if (Object.keys(errors).length) return failed({ errors, values: kept });

  let token: { token: string; expires_at: string } | undefined;
  try {
    const { data, error, response } = await serverApi().POST("/api/v1/auth/sign-up", {
      body: { email: values.email, password: values.password, display_name: values.name, locale },
      headers: await forwardedForHeader(),
    });
    if (response.status === 409) return failed({ errors: { email: "taken" }, values: kept });
    if (response.status === 422) {
      const field = (error as ApiError)?.error?.details?.field;
      return failed({ errors: field === "email" ? { email: "invalidEmail" } : { password: "tooShort" }, values: kept });
    }
    if (response.status === 429) return failed({ errors: {}, formError: "rateLimited", values: kept });
    token = data;
  } catch {
    // Network error: handled below.
  }
  if (!token) return failed({ errors: {}, formError: "unavailable", values: kept });
  await setSessionCookie(token.token, token.expires_at);
  redirect(destination(locale, returnTo));
}

export async function changePassword(email: string, _previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = readAuthForm(formData);
  const errors = validatePasswordChange(values, email);
  if (Object.keys(errors).length) return failed({ errors, values: {} });
  const session = await getSession();
  if (!session) return failed({ errors: {}, formError: "forbidden", values: {} });
  try {
    const { error, response } = await serverApi(session.accessToken).POST("/api/v1/me/password", {
      body: { current_password: values.current, new_password: values.password },
    });
    if (response.status === 204) return { status: "success" };
    if (response.status === 401) return failed({ errors: {}, formError: "forbidden", values: {} });
    if (response.status === 422) {
      const field = (error as ApiError)?.error?.details?.field;
      return failed({ errors: field === "current_password" ? { current: "wrong" } : { password: "tooShort" }, values: {} });
    }
  } catch {
    // Network error: handled below.
  }
  return failed({ errors: {}, formError: "unavailable", values: {} });
}

/** Staff admin: a temporary password for someone who forgot theirs (shown once). */
export async function resetPassword(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = readAuthForm(formData);
  const kept = { email: values.email };
  const errors = validatePasswordReset(values);
  if (Object.keys(errors).length) return failed({ errors, values: kept });
  const session = await getSession();
  if (!session) return failed({ errors: {}, formError: "forbidden", values: kept });
  try {
    const { data, response } = await serverApi(session.accessToken).POST("/api/v1/admin/accounts/password-reset", {
      body: { email: values.email },
    });
    if (data) return { status: "success", temporaryPassword: data.temporary_password, email: values.email };
    if (response.status === 404 && (await isStaff(session.accessToken))) return failed({ errors: { email: "unknownAccount" }, values: kept });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return failed({ errors: {}, formError: "forbidden", values: kept });
    }
  } catch {
    // Network error: handled below.
  }
  return failed({ errors: {}, formError: "unavailable", values: kept });
}

/** 404 means "unknown email" for staff, "not staff" for anyone else. */
async function isStaff(token: string): Promise<boolean> {
  const { data } = await serverApi(token).GET("/api/v1/me");
  return Boolean(data?.memberships.some((m) => m.role === "staff_admin"));
}
