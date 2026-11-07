"use server";

import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { fieldsFromApiError, forwardedForHeader } from "@/lib/client-ip";
import { CONTACT_FIELDS, parseContactForm, submittedValues } from "@/lib/contact/schema";
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
      headers: await forwardedForHeader(),
    });

    if (response.status === 202) return { status: "success" };
    if (response.status === 429) {
      return { status: "error", fieldErrors: [], formError: "rateLimited", values };
    }
    if (response.status === 422) {
      return { status: "error", fieldErrors: fieldsFromApiError(error, CONTACT_FIELDS), values };
    }
  } catch {
    // Network error: handled below.
  }
  return { status: "error", fieldErrors: [], formError: "unavailable", values };
}
