"use client";

import { Square } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type AIModel, createSseParser, type PlaygroundEvent, type PromptSummary } from "@/lib/ai";

type Stats = Extract<PlaygroundEvent, { type: "done" }>;

export type PlaygroundProps = {
  models: AIModel[];
  prompts: (PromptSummary & { variables: string[] })[];
};

/** Tries a model or a prompt and streams the answer (TASK-079). Charged to DEV4INNOVA. */
export function Playground({ models, prompts }: PlaygroundProps) {
  const t = useTranslations("Admin.ai");
  const format = useFormatter();
  const [promptKey, setPromptKey] = useState("");
  const [output, setOutput] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prompt = prompts.find((p) => p.key === promptKey);
  const usable = models.filter((m) => m.is_enabled);
  // Error codes come from the API: unknown ones get the generic message.
  const errorText = (code: string | undefined) => {
    const key = `errors.${code}` as "errors.generic";
    return code && t.has(key) ? t(key) : t("errors.generic");
  };
  const stopReason = (reason: string) => {
    const key = `stopReasons.${reason}` as "stopReasons.end";
    return t.has(key) ? t(key) : reason;
  };

  async function start(form: HTMLFormElement) {
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? "");
    const maxTokens = text("maxTokens").trim();
    const body = {
      model_id: text("model") || null,
      prompt_key: promptKey || null,
      system: promptKey ? null : text("system"),
      message: text("message"),
      variables: Object.fromEntries((prompt?.variables ?? []).map((name) => [name, text(`var-${name}`)])),
      max_tokens: maxTokens ? Number(maxTokens) : null,
    };
    const controller = new AbortController();
    abortRef.current = controller;
    setOutput("");
    setStats(null);
    setError(null);
    setRunning(true);
    try {
      const response = await fetch("/api/admin/ai/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
        setError(errorText(payload?.error?.code));
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const parse = createSseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parse(value)) {
          if (event.type === "delta") setOutput((previous) => previous + event.text);
          else if (event.type === "done") setStats(event);
          else setError(errorText(event.code));
        }
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError(t("errors.generic"));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        aria-labelledby="playground-title"
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void start(event.currentTarget);
        }}
      >
        <h2 id="playground-title" className="text-heading-lg font-semibold">{t("playground.request")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("playground.model")}>
            <NativeSelect name="model" defaultValue="">
              <option value="">{t("playground.defaultModel")}</option>
              {usable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                  {m.provider_configured ? "" : ` (${t("models.notConfigured")})`}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t("playground.prompt")}>
            <NativeSelect name="prompt" value={promptKey} onChange={(event) => setPromptKey(event.target.value)}>
              <option value="">{t("playground.noPrompt")}</option>
              {prompts.map((p) => (
                <option key={p.key} value={p.key} disabled={p.active_version === null}>{p.key}</option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        {prompt ? (
          prompt.variables.map((name) => (
            <FormField key={name} label={t("playground.variable", { name })} required requiredLabel={t("required")}>
              <Textarea name={`var-${name}`} rows={2} required maxLength={20000} />
            </FormField>
          ))
        ) : (
          <FormField label={t("playground.system")} description={t("playground.systemHelp")}>
            <Textarea name="system" rows={4} maxLength={50000} />
          </FormField>
        )}
        <FormField
          label={t("playground.message")}
          description={prompt ? t("playground.messageOptional") : undefined}
          required={!prompt}
          requiredLabel={t("required")}
        >
          <Textarea name="message" rows={5} required={!prompt} maxLength={20000} />
        </FormField>
        <FormField label={t("playground.maxTokens")} description={t("playground.maxTokensHelp")}>
          <Input name="maxTokens" type="number" min={1} className="w-40" />
        </FormField>
        <p className="text-sm text-muted-foreground">{t("playground.billing")}</p>
        <div className="flex gap-3">
          <Button type="submit" loading={running}>{t("playground.run")}</Button>
          {running ? (
            <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
              <Square aria-hidden="true" />
              {t("playground.stop")}
            </Button>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="playground-answer" className="flex flex-col gap-4">
        <h2 id="playground-answer" className="text-heading-lg font-semibold">{t("playground.answer")}</h2>
        {error ? <p role="alert" className="rounded-lg border border-destructive bg-accent p-4 text-sm font-medium text-accent-foreground">{error}</p> : null}
        {/* Model output is untrusted: shown as plain text, never as HTML. */}
        <div
          aria-live="polite"
          aria-busy={running}
          className="min-h-48 rounded-xl border border-border bg-card p-5 whitespace-pre-wrap break-words"
        >
          {output || <span className="text-muted-foreground">{running ? t("playground.waiting") : t("playground.empty")}</span>}
        </div>
        {stats ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">{t("playground.tokens")}</dt><dd className="tabular-nums">{format.number(stats.input_tokens)} → {format.number(stats.output_tokens)}</dd></div>
            <div><dt className="text-muted-foreground">{t("playground.cost")}</dt><dd className="tabular-nums">{format.number(Number(stats.cost_eur), { style: "currency", currency: "EUR", maximumFractionDigits: 6 })}</dd></div>
            <div><dt className="text-muted-foreground">{t("playground.latency")}</dt><dd className="tabular-nums">{format.number(stats.latency_ms / 1000, { maximumFractionDigits: 1 })} s</dd></div>
            <div><dt className="text-muted-foreground">{t("playground.servedModel")}</dt><dd className="font-mono text-xs">{stats.served_model}</dd></div>
            <div><dt className="text-muted-foreground">{t("playground.stopReason")}</dt><dd>{stopReason(stats.stop_reason)}</dd></div>
          </dl>
        ) : null}
      </section>
    </div>
  );
}
