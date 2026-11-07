"use client";

import { Check, Copy, Send, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSseParser } from "@/lib/ai";
import { type AIChatMessage, type Kind, MESSAGE_MAX_CHARS } from "@/lib/ai-experiences";
import { cn } from "@/lib/utils";

type ChatMessage = Pick<AIChatMessage, "id" | "role" | "text" | "status">;

export type ChatProps = {
  org: string;
  sessionId: string;
  kind: Kind;
  initialMessages: ChatMessage[];
};

/**
 * A conversation with streamed answers (TASK-083 to TASK-085). Answers are shown as plain
 * text, never as HTML: model output is untrusted.
 */
export function Chat({ org, sessionId, kind, initialMessages }: ChatProps) {
  const t = useTranslations("AI");
  const inputId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const errorText = (code: string | undefined) => {
    const key = `errors.${code}` as "errors.generic";
    return code && t.has(key) ? t(key) : t("errors.generic");
  };

  async function send(text: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setRunning(true);
    const answerId = `pending-${Date.now()}`;
    let answered = false;
    try {
      const response = await fetch(`/api/ai/${org}/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
        setError(errorText(payload?.error?.code));
        return;
      }
      setMessages((previous) => [
        ...previous,
        ...(text ? [{ id: `user-${Date.now()}`, role: "user" as const, text, status: "ok" as const }] : []),
        { id: answerId, role: "assistant", text: "", status: "ok" },
      ]);
      answered = true;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const parse = createSseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parse(value)) {
          setMessages((previous) =>
            previous.map((m) => {
              if (m.id !== answerId) return m;
              if (event.type === "delta") return { ...m, text: m.text + event.text };
              if (event.type === "done") {
                const status = event.stop_reason === "refusal" ? "refused" : event.stop_reason === "max_tokens" ? "incomplete" : "ok";
                return { ...m, status };
              }
              return { ...m, status: "error" };
            }),
          );
          if (event.type === "error") setError(errorText(event.code));
        }
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError(t("errors.generic"));
      if (answered) {
        setMessages((previous) => previous.map((m) => (m.id === answerId ? { ...m, status: "incomplete" } : m)));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  // The content generator writes the first version as soon as the session opens.
  useEffect(() => {
    if (kind === "content" && initialMessages.length === 0 && !started.current) {
      started.current = true;
      void send("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 && !running ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-6 text-muted-foreground">{t(`empty.${kind}`)}</p>
      ) : (
        <ol aria-label={t("session.messages")} aria-live="polite" aria-busy={running} className="flex flex-col gap-4">
          {messages.map((message) => (
            <li key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <article
                aria-label={message.role === "user" ? t("session.you") : t("session.ai")}
                className={cn(
                  "flex max-w-[min(48rem,100%)] flex-col gap-2 rounded-xl px-4 py-3",
                  message.role === "user" ? "bg-secondary text-secondary-foreground" : "border border-border bg-card",
                )}
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.text || (running && message.role === "assistant" ? <span className="text-muted-foreground">{t("session.writing")}</span> : null)}
                </p>
                {message.role === "assistant" && message.status !== "ok" ? (
                  <p className="text-xs font-medium text-destructive">{t(`statuses.${message.status as "refused" | "incomplete" | "error"}`)}</p>
                ) : null}
                {message.role === "assistant" && message.text && !(running && message.id.startsWith("pending")) ? (
                  <CopyButton text={message.text} />
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} />

      {error ? <p role="alert" className="rounded-lg border border-destructive bg-accent p-4 text-sm font-medium text-accent-foreground">{error}</p> : null}

      <form
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const text = String(new FormData(form).get("text") ?? "").trim();
          if (!text || running) return;
          form.reset();
          void send(text);
        }}
      >
        <label htmlFor={inputId} className="text-sm font-medium">{t(`input.${kind}`)}</label>
        <Textarea
          id={inputId}
          name="text"
          rows={3}
          maxLength={MESSAGE_MAX_CHARS}
          required
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter adds a line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("input.help")}</p>
          <div className="flex gap-2">
            {running ? (
              <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
                <Square aria-hidden="true" />
                {t("session.stop")}
              </Button>
            ) : null}
            <Button type="submit" disabled={running}>
              <Send aria-hidden="true" />
              {t("session.send")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("AI.session");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1.5 self-start rounded-md text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
      <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
    </button>
  );
}
