import type { components } from "@dev4innova/api-client";

/* Commerce and billing (EPIC 13): shared types and helpers of the portal and the back office. */

type Schemas = components["schemas"];
export type ClientBilling = Schemas["ClientBilling"];
export type AdminBilling = Schemas["AdminBilling"];
export type Product = Schemas["ProductOut"];
export type Offer = Schemas["Offer"];
export type CourseOffer = Schemas["CourseOffer"];
export type Profile = Schemas["ProfileOut"];
export type QuoteSummary = Schemas["QuoteSummary"];
export type Quote = Schemas["QuoteOut"];
export type InvoiceSummary = Schemas["InvoiceSummary"];
export type Invoice = Schemas["InvoiceOut"];
export type Payment = Schemas["PaymentOut"];
export type Subscription = Schemas["SubscriptionOut"];
export type BillingOrganization = Schemas["BillingOrganization"];

export const PRODUCT_KINDS = ["service", "subscription", "course"] as const;
export const INTERVALS = ["month", "year"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];
export type Interval = (typeof INTERVALS)[number];

/** 1 234,56 € / €1,234.56 from cents. */
export function money(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** "1 200,50" or "1200.5" (euros) to cents; null when empty, undefined when invalid. */
export function parseEuros(value: string): number | null | undefined {
  const normalized = value.replace(/[\s  €]/g, "").replace(",", ".");
  if (!normalized) return null;
  if (!/^-?\d{1,9}(\.\d{1,2})?$/.test(normalized)) return undefined;
  return Math.round(Number(normalized) * 100);
}

/** Cents as an editable amount ("1200,50" in French). */
export function centsToInput(cents: number, locale: string): string {
  const value = (cents / 100).toFixed(2);
  return locale === "fr" ? value.replace(".", ",") : value;
}

/** VAT rate in basis points from a percentage typed by a person ("5,5" → 550). */
export function parseRate(value: string): number | undefined {
  const normalized = value.replace(/[\s%]/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return undefined;
  const bp = Math.round(Number(normalized) * 100);
  return bp <= 10_000 ? bp : undefined;
}

export function rateLabel(bp: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bp / 100)} %`;
}

/** Totals of quote lines as the API computes them (half up per line). */
export function lineTotals(lines: { quantity: number; unitPriceCents: number; vatRateBp: number }[]) {
  let net = 0;
  let vat = 0;
  for (const line of lines) {
    const lineNet = Math.round(line.quantity * line.unitPriceCents);
    net += lineNet;
    vat += Math.round((lineNet * line.vatRateBp) / 10_000);
  }
  return { net, vat, gross: net + vat };
}

/** Payment pages we may send the browser to: Stripe Checkout, or the simulated one in development. */
export function isCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? true : parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}
