"use server";

import { headers } from "next/headers";

import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { CONTACT_FIELDS, type ContactField, parseContactForm, submittedValues } from "@/lib/contact/schema";
import type { ContactFormState } from "@/lib/contact/state";

/**
 * Contact form server action (TASK-057): validates, then sends the request to the API.
 * The visitor's address is forwarded so the API can rate-limit per visitor.
 */
export async function submitContact(
  locale: Locale,
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = submittedValues(formData);
  const parsed = parseContactForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    undefined;

  try {
    const { response, error } = await serverApi().POST("/api/v1/contact-requests", {
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company || null,
        topic: parsed.data.topic,
        message: parsed.data.message,
        locale,
        consent: true,
        website: parsed.data.website,
      },
      headers: clientIp ? { "X-Forwarded-For": clientIp } : {},
    });

    if (response.status === 202) return { status: "success" };
    if (response.status === 429) {
      return { status: "error", fieldErrors: [], formError: "rateLimited", values };
    }
    if (response.status === 422) {
      return { status: "error", fieldErrors: fieldsFromApiError(error), values };
    }
  } catch {
    // Network error: handled below.
  }
  return { status: "error", fieldErrors: [], formError: "unavailable", values };
}

/** Maps the API validation error (`details.errors[].loc`) to form fields. */
function fieldsFromApiError(error: unknown): ContactField[] {
  const errors = (error as { error?: { details?: { errors?: { loc?: unknown[] }[] } } })?.error
    ?.details?.errors;
  if (!Array.isArray(errors)) return [];
  const fields = errors
    .map((e) => (Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : undefined))
    .filter((key): key is ContactField => CONTACT_FIELDS.includes(key as ContactField));
  return [...new Set(fields)];
}
