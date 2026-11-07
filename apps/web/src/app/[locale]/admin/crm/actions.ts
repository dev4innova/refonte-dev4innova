"use server";

import { adminApi } from "@/lib/admin";
import { getSession } from "@/lib/auth/session";
import { type LeadStatus, type ManualActivityType, parseAmount, type QuoteStatus, type Stage } from "@/lib/crm";

/*
 * CRM Server Actions (TASK-067 to TASK-072). The API enforces staff access, roles and
 * isolation; these actions forward the user's token. Back-office pages are rendered per
 * request (never cached): the client refreshes the page after a successful action.
 */

export type CrmError =
  | "signin"
  | "forbidden"
  | "duplicate"
  | "notAssignable"
  | "validation"
  | "generic";

export type CrmResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: CrmError; leadId?: string };

async function api() {
  const session = await getSession();
  return session ? adminApi(session) : null;
}

type ApiError = { error?: { details?: Record<string, unknown> } } | undefined;

function errorFrom(status: number, body: unknown): CrmResult<never> {
  const details = (body as ApiError)?.error?.details ?? {};
  if (status === 401) return { ok: false, error: "signin" };
  if (status === 403 || status === 404) return { ok: false, error: "forbidden" };
  if (status === 409) {
    const leadId = typeof details.lead_id === "string" ? details.lead_id : undefined;
    return { ok: false, error: "duplicate", leadId };
  }
  if (status === 422) {
    return { ok: false, error: details.field === "owner_id" ? "notAssignable" : "validation" };
  }
  return { ok: false, error: "generic" };
}

const SIGNIN: CrmResult<never> = { ok: false, error: "signin" };
const done = { ok: true as const, data: undefined };

export type LeadInput = {
  email: string;
  name: string;
  company: string;
  phone: string;
  locale: "fr" | "en";
};

export async function createLead(input: LeadInput): Promise<CrmResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.POST("/api/v1/admin/crm/leads", {
    body: {
      email: input.email.trim(),
      name: input.name.trim(),
      company: input.company.trim() || null,
      phone: input.phone.trim() || null,
      locale: input.locale,
    },
  });
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}

export type LeadPatch = Partial<Omit<LeadInput, "email"> & { status: LeadStatus }>;

export async function updateLead(id: string, patch: LeadPatch): Promise<CrmResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const body = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      typeof value === "string" && (key === "company" || key === "phone") ? value.trim() || null : value,
    ]),
  );
  const { response, error } = await client.PATCH("/api/v1/admin/crm/leads/{lead_id}", {
    params: { path: { lead_id: id } },
    body,
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export async function assignLead(id: string, ownerId: string | null): Promise<CrmResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.PUT("/api/v1/admin/crm/leads/{lead_id}/owner", {
    params: { path: { lead_id: id } },
    body: { owner_id: ownerId },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export type ActivityInput = {
  type: ManualActivityType;
  body: string;
  /** Local date-time from <input type="datetime-local">, empty for now. */
  occurredAt: string;
  opportunityId: string | null;
};

export async function addActivity(leadId: string, input: ActivityInput): Promise<CrmResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const occurred = input.occurredAt ? new Date(input.occurredAt) : null;
  const { response, error } = await client.POST("/api/v1/admin/crm/leads/{lead_id}/activities", {
    params: { path: { lead_id: leadId } },
    body: {
      type: input.type,
      body: input.body,
      occurred_at: occurred && !Number.isNaN(occurred.getTime()) ? occurred.toISOString() : null,
      opportunity_id: input.opportunityId,
    },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export async function deleteLead(id: string): Promise<CrmResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/admin/crm/leads/{lead_id}", {
    params: { path: { lead_id: id } },
  });
  return response.status === 204 ? done : errorFrom(response.status, error);
}

export type OpportunityInput = {
  leadId: string;
  title: string;
  /** Decimal amount typed by the user ("12 000,50" accepted), empty for none. */
  amount: string;
  expectedCloseOn: string;
};

export async function createOpportunity(input: OpportunityInput): Promise<CrmResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const amount = parseAmount(input.amount);
  if (amount === undefined) return { ok: false, error: "validation" };
  const { response, error } = await client.POST("/api/v1/admin/crm/opportunities", {
    body: {
      lead_id: input.leadId,
      title: input.title.trim(),
      stage: "qualification",
      amount,
      currency: "EUR",
      expected_close_on: input.expectedCloseOn || null,
    },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export type OpportunityPatch = {
  stage?: Stage;
  title?: string;
  amount?: string;
  expectedCloseOn?: string;
  ownerId?: string | null;
};

export async function updateOpportunity(id: string, patch: OpportunityPatch): Promise<CrmResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const amount = patch.amount === undefined ? undefined : parseAmount(patch.amount);
  if (patch.amount !== undefined && amount === undefined) return { ok: false, error: "validation" };
  const { response, error } = await client.PATCH("/api/v1/admin/crm/opportunities/{opportunity_id}", {
    params: { path: { opportunity_id: id } },
    body: {
      stage: patch.stage ?? null,
      title: patch.title?.trim() || null,
      amount: amount ?? null,
      clear_amount: amount === null,
      expected_close_on: patch.expectedCloseOn || null,
      clear_expected_close_on: patch.expectedCloseOn === "",
      owner_id: patch.ownerId ?? null,
      clear_owner: patch.ownerId === null,
    },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<CrmResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.PATCH("/api/v1/admin/crm/quote-requests/{quote_id}", {
    params: { path: { quote_id: id } },
    body: { status },
  });
  return response.ok ? done : errorFrom(response.status, error);
}
