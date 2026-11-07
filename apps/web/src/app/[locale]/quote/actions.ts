"use server";

import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { fieldsFromApiError, forwardedForHeader } from "@/lib/client-ip";
import {
  parseQuoteForm,
  QUOTE_FIELDS,
  type QuoteFormState,
  submittedQuoteValues,
} from "@/lib/quote/schema";

/** Quote request server action (TASK-072): validates, then sends the request to the API,
 * which records the prospect and opens an opportunity in the CRM. */
export async function submitQuote(
  locale: Locale,
  _previous: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const values = submittedQuoteValues(formData);
  const parsed = parseQuoteForm(formData);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const { data } = parsed;
  try {
    const { response, error } = await serverApi().POST("/api/v1/quote-requests", {
      body: {
        name: data.name,
        email: data.email,
        company: data.company || null,
        phone: data.phone || null,
        service: data.service || null,
        need: data.need,
        budget: data.budget,
        timeline: data.timeline,
        locale,
        consent: true,
        website: data.website,
      },
      headers: await forwardedForHeader(),
    });
    if (response.status === 202) return { status: "success" };
    if (response.status === 429) {
      return { status: "error", fieldErrors: [], formError: "rateLimited", values };
    }
    if (response.status === 422) {
      const fieldErrors = fieldsFromApiError(error, QUOTE_FIELDS);
      // A refused service (unpublished meanwhile) is not the visitor's fault: generic error.
      return fieldErrors.length
        ? { status: "error", fieldErrors, values }
        : { status: "error", fieldErrors: [], formError: "unavailable", values };
    }
  } catch {
    // Network error: handled below.
  }
  return { status: "error", fieldErrors: [], formError: "unavailable", values };
}
