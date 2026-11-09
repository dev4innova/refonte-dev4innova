"use server";

import { api, checkoutResult, DONE, errorFrom, type BillingResult, SIGNIN } from "@/lib/billing-actions";

/* Client billing Server Actions (TASK-111 to TASK-114): owners and admins; the API checks it. */

export type ProfileInput = {
  legalName: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string;
  siren: string;
  email: string;
};

export async function saveProfile(org: string, input: ProfileInput): Promise<BillingResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.PUT("/api/v1/organizations/{organization_id}/billing/profile", {
    params: { path: { organization_id: org } },
    body: {
      legal_name: input.legalName.trim(),
      address: input.address.trim(),
      postal_code: input.postalCode.trim(),
      city: input.city.trim(),
      country: input.country.trim().toUpperCase() || "FR",
      vat_number: input.vatNumber.replace(/\s/g, "") || null,
      siren: input.siren.replace(/\s/g, "") || null,
      email: input.email.trim(),
    },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function acceptQuote(org: string, id: string, name: string): Promise<BillingResult<{ invoiceId: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (name.trim().length < 2) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/billing/quotes/{quote_id}/accept",
    { params: { path: { organization_id: org, quote_id: id } }, body: { name: name.trim(), agree: true } },
  );
  return data ? { ok: true, data: { invoiceId: data.id } } : errorFrom(response.status, error);
}

export async function declineQuote(org: string, id: string, reason: string): Promise<BillingResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/billing/quotes/{quote_id}/decline",
    { params: { path: { organization_id: org, quote_id: id } }, body: { reason: reason.trim() || null } },
  );
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function payInvoice(org: string, id: string, locale: "fr" | "en"): Promise<BillingResult<{ url: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/billing/invoices/{invoice_id}/checkout",
    { params: { path: { organization_id: org, invoice_id: id }, query: { locale } } },
  );
  return checkoutResult(data, response.status, error);
}

export async function subscribe(org: string, productId: string, locale: "fr" | "en"): Promise<BillingResult<{ url: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.POST("/api/v1/organizations/{organization_id}/billing/subscriptions", {
    params: { path: { organization_id: org } },
    body: { product_id: productId, locale },
  });
  return checkoutResult(data, response.status, error);
}

export async function setCancellation(org: string, id: string, cancel: boolean): Promise<BillingResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/billing/subscriptions/{subscription_id}/cancel",
    { params: { path: { organization_id: org, subscription_id: id } }, body: { cancel } },
  );
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function buyCourse(slug: string, organizationId: string, locale: "fr" | "en"): Promise<BillingResult<{ url: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.POST("/api/v1/me/billing/courses/{slug}/checkout", {
    params: { path: { slug } },
    body: { organization_id: organizationId || null, locale },
  });
  return checkoutResult(data, response.status, error);
}
