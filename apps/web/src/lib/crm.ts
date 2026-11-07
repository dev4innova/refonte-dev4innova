import type { components } from "@dev4innova/api-client";

/* CRM (EPIC 07): shared types and constants for the back office (client and server). */

export type Lead = components["schemas"]["LeadSummary"];
export type LeadDetail = components["schemas"]["LeadDetail"];
export type Activity = components["schemas"]["ActivityOut"];
export type Opportunity = components["schemas"]["OpportunityOut"];
export type QuoteRequest = components["schemas"]["QuoteRequestOut"];
export type Person = components["schemas"]["Person"];
export type CrmDashboard = components["schemas"]["Dashboard"];

export const LEAD_STATUSES = ["new", "contacted", "qualified", "customer", "unqualified"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const OPEN_STAGES = ["qualification", "proposal", "negotiation"] as const;
export const STAGES = [...OPEN_STAGES, "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const MANUAL_ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const;
export type ManualActivityType = (typeof MANUAL_ACTIVITY_TYPES)[number];
export const QUOTE_STATUSES = ["new", "in_review", "answered", "declined"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const OWNER_FILTERS = ["any", "me", "unassigned"] as const;
export type OwnerFilter = (typeof OWNER_FILTERS)[number];

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/** Name shown for a staff member. */
export function personLabel(person: Person | null | undefined): string | null {
  if (!person) return null;
  return person.display_name || person.email || null;
}

/** Badge tone of each status or stage. */
export function statusTone(value: string): "accent" | "success" | "muted" | "neutral" {
  if (value === "new") return "accent";
  if (value === "won" || value === "customer" || value === "answered") return "success";
  if (value === "lost" || value === "unqualified" || value === "declined") return "muted";
  return "neutral";
}

/** "12 000,50 €" → "12000.50"; null when empty, undefined when not a valid amount. */
export function parseAmount(value: string): string | null | undefined {
  const normalized = value.replace(/[\s\u00a0\u202f€]/g, "").replace(",", ".");
  if (!normalized) return null;
  return /^\d{1,10}(\.\d{1,2})?$/.test(normalized) ? normalized : undefined;
}
