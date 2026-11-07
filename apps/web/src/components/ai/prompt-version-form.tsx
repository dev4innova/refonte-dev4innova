"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { activatePromptVersion, addPromptVersion, createPrompt } from "@/app/[locale]/admin/ai/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type AIModel, PROMPT_KEY_PATTERN, type PromptVersion, templateVariables } from "@/lib/ai";
import { useRouter } from "@/i18n/navigation";

import { useAiAction } from "./use-ai-action";

/** Creates a prompt (version 1), or saves a new version of an existing one (TASK-078). */
export function PromptVersionForm({
  promptKey,
  base,
  models,
}: {
  /** Existing prompt: a new version is saved. Absent: a new prompt is created. */
  promptKey?: string;
  /** Version the form starts from. */
  base?: PromptVersion;
  models: AIModel[];
}) {
  const t = useTranslations("Admin.ai");
  const router = useRouter();
  const { pending, error, run, setError } = useAiAction();
  const [template, setTemplate] = useState(base?.template ?? "");
  const variables = templateVariables(template);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        const system = text("system");
        if (system.includes("{{")) {
          setError(t("errors.systemVariables"));
          return;
        }
        const maxTokens = text("maxTokens").trim();
        const version = {
          system,
          template: text("template"),
          modelId: text("model") || null,
          maxTokens: maxTokens ? Number(maxTokens) : null,
          notes: text("notes").trim(),
          activate: promptKey ? data.get("activate") === "on" : true,
        };
        if (promptKey) {
          run(() => addPromptVersion(promptKey, version));
          return;
        }
        const key = text("key").trim();
        if (!PROMPT_KEY_PATTERN.test(key)) {
          setError(t("errors.key"));
          return;
        }
        run(
          () => createPrompt(key, text("description"), version),
          () => router.push({ pathname: "/admin/ai/prompts/[key]", params: { key } }),
        );
      }}
    >
      {promptKey ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("prompts.key")} description={t("prompts.keyHelp")} required requiredLabel={t("required")}>
            <Input name="key" required maxLength={100} spellCheck={false} className="font-mono text-sm" />
          </FormField>
          <FormField label={t("prompts.description")}>
            <Input name="description" maxLength={300} />
          </FormField>
        </div>
      )}
      <FormField label={t("prompts.system")} description={t("prompts.systemHelp")} required requiredLabel={t("required")}>
        <Textarea name="system" rows={6} required maxLength={50000} defaultValue={base?.system} />
      </FormField>
      <FormField label={t("prompts.template")} description={t("prompts.templateHelp")}>
        <Textarea
          name="template"
          rows={5}
          maxLength={50000}
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
        />
      </FormField>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {variables.length ? t("prompts.variables", { names: variables.join(", ") }) : t("prompts.noVariables")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={t("prompts.model")}>
          <NativeSelect name="model" defaultValue={base?.model_id ?? ""}>
            <option value="">{t("prompts.defaultModel")}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t("prompts.maxTokens")}>
          <Input name="maxTokens" type="number" min={1} defaultValue={base?.max_tokens ?? ""} />
        </FormField>
        <FormField label={t("prompts.notes")}>
          <Input name="notes" maxLength={300} />
        </FormField>
      </div>
      {promptKey ? (
        <FormField label={t("prompts.activateNow")} inline>
          <Checkbox name="activate" value="on" defaultChecked />
        </FormField>
      ) : null}
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" loading={pending}>
          {promptKey ? t("prompts.saveVersion") : t("prompts.create")}
        </Button>
      </div>
    </form>
  );
}

/** Makes an older or newer version the active one. */
export function ActivateVersionButton({ promptKey, version }: { promptKey: string; version: number }) {
  const t = useTranslations("Admin.ai");
  const { pending, error, run } = useAiAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        loading={pending}
        onClick={() => run(() => activatePromptVersion(promptKey, version))}
      >
        {t("prompts.activate", { version })}
      </Button>
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
