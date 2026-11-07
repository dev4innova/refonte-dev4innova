"use server";

import { adminApi } from "@/lib/admin";
import { getSession } from "@/lib/auth/session";
import type { Provider } from "@/lib/ai";

/*
 * AI Gateway back-office Server Actions (TASK-077, TASK-078, TASK-081). The API enforces
 * the staff admin role; pages are rendered per request and refreshed by the client.
 */

export type AIError = "signin" | "forbidden" | "duplicate" | "conflict" | "validation" | "generic";
export type AIResult<T = undefined> = { ok: true; data: T } | { ok: false; error: AIError };

async function api() {
  const session = await getSession();
  return session ? adminApi(session) : null;
}

function errorFrom(status: number, body: unknown): AIResult<never> {
  if (status === 401) return { ok: false, error: "signin" };
  if (status === 403 || status === 404) return { ok: false, error: "forbidden" };
  if (status === 409) {
    const field = (body as { error?: { details?: { field?: string } } })?.error?.details?.field;
    return { ok: false, error: field ? "duplicate" : "conflict" };
  }
  if (status === 422) return { ok: false, error: "validation" };
  return { ok: false, error: "generic" };
}

const SIGNIN: AIResult<never> = { ok: false, error: "signin" };
const done = { ok: true as const, data: undefined };

export type ModelInput = {
  provider: Provider;
  modelId: string;
  displayName: string;
  inputPrice: string;
  outputPrice: string;
  contextWindow: number;
  maxOutputTokens: number;
  options: Record<string, string>;
  isEnabled: boolean;
  isDefault: boolean;
};

export async function createModel(input: ModelInput): Promise<AIResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST("/api/v1/admin/ai/models", {
    body: {
      provider: input.provider,
      model_id: input.modelId.trim(),
      display_name: input.displayName.trim(),
      input_price_usd_per_mtok: input.inputPrice,
      output_price_usd_per_mtok: input.outputPrice,
      context_window: input.contextWindow,
      max_output_tokens: input.maxOutputTokens,
      options: input.options,
      is_enabled: input.isEnabled,
      is_default: input.isDefault,
    },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export type ModelPatch = Partial<Omit<ModelInput, "provider" | "modelId">>;

export async function updateModel(id: string, patch: ModelPatch): Promise<AIResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.PATCH("/api/v1/admin/ai/models/{model_id}", {
    params: { path: { model_id: id } },
    body: {
      display_name: patch.displayName?.trim() || null,
      input_price_usd_per_mtok: patch.inputPrice ?? null,
      output_price_usd_per_mtok: patch.outputPrice ?? null,
      context_window: patch.contextWindow ?? null,
      max_output_tokens: patch.maxOutputTokens ?? null,
      options: patch.options ?? null,
      is_enabled: patch.isEnabled ?? null,
      is_default: patch.isDefault ?? null,
    },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export type PromptVersionInput = {
  system: string;
  template: string;
  modelId: string | null;
  maxTokens: number | null;
  notes: string;
  activate: boolean;
};

export async function createPrompt(
  key: string,
  description: string,
  version: PromptVersionInput,
): Promise<AIResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST("/api/v1/admin/ai/prompts", {
    body: {
      key: key.trim(),
      description: description.trim(),
      system: version.system,
      template: version.template,
      model_id: version.modelId,
      max_tokens: version.maxTokens,
      notes: version.notes,
      activate: true,
    },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export async function addPromptVersion(key: string, version: PromptVersionInput): Promise<AIResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST("/api/v1/admin/ai/prompts/{key}/versions", {
    params: { path: { key } },
    body: {
      system: version.system,
      template: version.template,
      model_id: version.modelId,
      max_tokens: version.maxTokens,
      notes: version.notes,
      activate: version.activate,
    },
  });
  return response.ok ? done : errorFrom(response.status, error);
}

export async function activatePromptVersion(key: string, version: number): Promise<AIResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST(
    "/api/v1/admin/ai/prompts/{key}/versions/{version}/activate",
    { params: { path: { key, version } } },
  );
  return response.ok ? done : errorFrom(response.status, error);
}

/** Monthly budget in euros ("" goes back to the default budget). */
export async function setQuota(organizationId: string, budget: string): Promise<AIResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const normalized = budget.replace(/[\s  €]/g, "").replace(",", ".");
  if (normalized && !/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return { ok: false, error: "validation" };
  const { response, error } = await client.PUT("/api/v1/admin/ai/quotas/{organization_id}", {
    params: { path: { organization_id: organizationId } },
    body: { monthly_budget_eur: normalized || null },
  });
  return response.status === 204 ? done : errorFrom(response.status, error);
}
