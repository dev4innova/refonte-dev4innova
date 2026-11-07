"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { createModel, updateModel } from "@/app/[locale]/admin/ai/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type AIModel, formatOptions, parseOptions, PROVIDERS, type Provider } from "@/lib/ai";

import { useAiAction } from "./use-ai-action";

/** Adds a model to the registry, or edits one (TASK-077). */
export function ModelForm({ model }: { model?: AIModel }) {
  const t = useTranslations("Admin.ai");
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, error, run, setError } = useAiAction();

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "").trim();
        const options = parseOptions(text("options"));
        if (options === null) {
          setError(t("errors.options"));
          return;
        }
        const common = {
          displayName: text("displayName"),
          inputPrice: text("inputPrice").replace(",", "."),
          outputPrice: text("outputPrice").replace(",", "."),
          contextWindow: Number(text("contextWindow")),
          maxOutputTokens: Number(text("maxOutputTokens")),
          options,
          isEnabled: data.get("isEnabled") === "on",
          isDefault: data.get("isDefault") === "on",
        };
        run(
          () =>
            model
              ? updateModel(model.id, common)
              : createModel({ ...common, provider: text("provider") as Provider, modelId: text("modelId") }),
          () => {
            if (!model) formRef.current?.reset();
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {model ? null : (
          <>
            <FormField label={t("models.provider")} required requiredLabel={t("required")}>
              <NativeSelect name="provider" defaultValue="anthropic">
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{t(`providers.${p}`)}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t("models.modelId")} description={t("models.modelIdHelp")} required requiredLabel={t("required")}>
              <Input name="modelId" required maxLength={120} spellCheck={false} className="font-mono text-sm" />
            </FormField>
          </>
        )}
        <FormField label={t("models.displayName")} required requiredLabel={t("required")}>
          <Input name="displayName" required maxLength={120} defaultValue={model?.display_name} />
        </FormField>
        <FormField label={t("models.inputPrice")} required requiredLabel={t("required")}>
          <Input name="inputPrice" required inputMode="decimal" defaultValue={model?.input_price_usd_per_mtok} />
        </FormField>
        <FormField label={t("models.outputPrice")} required requiredLabel={t("required")}>
          <Input name="outputPrice" required inputMode="decimal" defaultValue={model?.output_price_usd_per_mtok} />
        </FormField>
        <FormField label={t("models.contextWindow")} required requiredLabel={t("required")}>
          <Input name="contextWindow" type="number" min={1000} required defaultValue={model?.context_window ?? 200000} />
        </FormField>
        <FormField label={t("models.maxOutputTokens")} description={t("models.maxOutputTokensHelp")} required requiredLabel={t("required")}>
          <Input name="maxOutputTokens" type="number" min={1} required defaultValue={model?.max_output_tokens ?? 16000} />
        </FormField>
      </div>
      <FormField label={t("models.options")} description={t("models.optionsHelp")}>
        <Textarea name="options" rows={3} spellCheck={false} className="font-mono text-sm" defaultValue={model ? formatOptions(model.options) : ""} />
      </FormField>
      <div className="flex flex-wrap gap-6">
        <FormField label={t("models.enabled")} inline>
          <Checkbox name="isEnabled" value="on" defaultChecked={model?.is_enabled ?? true} />
        </FormField>
        <FormField label={t("models.default")} inline>
          <Checkbox name="isDefault" value="on" defaultChecked={model?.is_default ?? false} />
        </FormField>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" variant={model ? "secondary" : "primary"} loading={pending}>
          {model ? t("save") : t("models.add")}
        </Button>
      </div>
    </form>
  );
}
