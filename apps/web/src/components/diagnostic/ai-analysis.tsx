"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createSseParser } from "@/lib/ai";

type Status = "none" | "pending" | "done" | "error";

/**
 * The personalized AI analysis (TASK-092): written on the first visit of the full report,
 * streamed, then kept. Plain text only: model output is untrusted.
 */
export function AiAnalysis({ token, status, text }: { token: string; status: Status; text: string | null }) {
  const t = useTranslations("Diagnostic.analysis");
  const [content, setContent] = useState(text ?? "");
  const [state, setState] = useState<"idle" | "writing" | "done" | "error">(status === "done" ? "done" : "idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const started = useRef(false);

  const write = useCallback(async () => {
    setState("writing");
    setContent("");
    setErrorCode(null);
    try {
      const response = await fetch(`/api/diagnostic/${token}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
        setErrorCode(payload?.error?.code ?? "unavailable");
        setState("error");
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const parse = createSseParser();
      let failed = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parse(value)) {
          if (event.type === "delta") setContent((previous) => previous + event.text);
          if (event.type === "error") {
            failed = true;
            setErrorCode(event.code);
          }
        }
      }
      setState(failed ? "error" : "done");
    } catch {
      setErrorCode("unavailable");
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    if (status !== "done" && status !== "pending" && !started.current) {
      started.current = true;
      void write();
    }
  }, [status, write]);

  const errorKey = errorCode === "conflict" ? "conflict" : errorCode === "diagnostic_daily_limit" || errorCode === "ai_quota_exceeded" ? "busy" : "failed";

  return (
    <div className="flex flex-col gap-3" aria-busy={state === "writing"}>
      {status === "pending" && state === "idle" ? <p className="text-muted-foreground">{t("pending")}</p> : null}
      {state === "writing" && !content ? <p className="text-muted-foreground">{t("writing")}</p> : null}
      {content ? <div aria-live="polite" className="whitespace-pre-wrap break-words leading-relaxed">{content}</div> : null}
      {state === "error" ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${errorKey}`)}</p>
          {errorKey !== "busy" ? <Button size="sm" variant="outline" onClick={() => void write()}>{t("retry")}</Button> : null}
        </div>
      ) : null}
      {state === "done" ? <p className="text-xs text-muted-foreground">{t("disclaimer")}</p> : null}
    </div>
  );
}
