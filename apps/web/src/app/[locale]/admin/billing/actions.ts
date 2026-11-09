"use server";

import type { Interval, ProductKind } from "@/lib/billing";
import { api, DONE, errorFrom, type BillingResult, SIGNIN } from "@/lib/billing-actions";

/* Back-office billing Server Actions (EPIC 13): staff_admin and staff_sales; the API checks it. */

export type ProductInput = {
  code: string;
  kind: ProductKind;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  unitPriceCents: number;
  vatRateBp: number;
  interval: Interval | null;
  courseId: string;
  active: boolean;
};

export async function saveProduct(id: string | null, input: ProductInput): Promise<BillingResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!input.code.trim() || !input.name.fr || !input.name.en || input.unitPriceCents < 0) return { ok: false, error: "validation" };
  const body = {
    code: input.code.trim(),
    kind: input.kind,
    name: input.name,
    description: input.description,
    unit_price_cents: input.unitPriceCents,
    vat_rate_bp: input.vatRateBp,
    interval: input.kind === "subscription" ? input.interval : null,
    course_id: input.kind === "course" ? input.courseId || null : null,
    active: input.active,
  };
  const { response, error } = id
    ? await client.PUT("/api/v1/admin/billing/products/{product_id}", { params: { path: { product_id: id } }, body })
    : await client.POST("/api/v1/admin/billing/products", { body });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export type QuoteLineInput = { productId: string; description: string; quantity: string; unitPriceCents: number; vatRateBp: number };
export type QuoteInput = {
  organizationId: string;
  title: string;
  notes: string;
  validUntil: string;
  depositPercent: number;
  lines: QuoteLineInput[];
};

export async function saveQuote(id: string | null, input: QuoteInput): Promise<BillingResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const lines = input.lines.filter((l) => l.description.trim());
  if (input.title.trim().length < 2 || !input.validUntil || lines.length === 0 || (!id && !input.organizationId)) {
    return { ok: false, error: "validation" };
  }
  const body = {
    title: input.title.trim(),
    notes: input.notes.trim(),
    valid_until: input.validUntil,
    deposit_percent: Math.min(100, Math.max(0, Math.round(input.depositPercent || 0))),
    lines: lines.map((l) => ({
      product_id: l.productId || null,
      description: l.description.trim(),
      quantity: l.quantity.replace(",", "."),
      unit_price_cents: l.unitPriceCents,
      vat_rate_bp: l.vatRateBp,
    })),
  };
  const { data, response, error } = id
    ? await client.PUT("/api/v1/admin/billing/quotes/{quote_id}", { params: { path: { quote_id: id } }, body })
    : await client.POST("/api/v1/admin/billing/quotes", { body: { ...body, organization_id: input.organizationId } });
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}

export async function quoteAction(id: string, action: "send" | "cancel" | "balance"): Promise<BillingResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const paths = {
    send: "/api/v1/admin/billing/quotes/{quote_id}/send",
    cancel: "/api/v1/admin/billing/quotes/{quote_id}/cancel",
    balance: "/api/v1/admin/billing/quotes/{quote_id}/balance",
  } as const;
  const { response, error } = await client.POST(paths[action], { params: { path: { quote_id: id } } });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function recordTransfer(
  id: string,
  input: { amountCents: number; receivedOn: string; reference: string },
): Promise<BillingResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (input.amountCents <= 0 || !input.receivedOn) return { ok: false, error: "validation" };
  const { response, error } = await client.POST("/api/v1/admin/billing/invoices/{invoice_id}/transfers", {
    params: { path: { invoice_id: id } },
    body: { amount_cents: input.amountCents, received_on: input.receivedOn, reference: input.reference.trim() || null },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function creditNote(id: string, reason: string): Promise<BillingResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (reason.trim().length < 3) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST("/api/v1/admin/billing/invoices/{invoice_id}/credit-note", {
    params: { path: { invoice_id: id } },
    body: { reason: reason.trim() },
  });
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}
