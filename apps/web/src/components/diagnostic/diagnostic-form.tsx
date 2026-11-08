"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { submitDiagnostic } from "@/app/[locale]/diagnostic/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useRouter } from "@/i18n/navigation";
import { type Questionnaire, unanswered } from "@/lib/diagnostic";
import { cn } from "@/lib/utils";

/**
 * The diagnostic in steps: profile, then one step per dimension (TASK-089). Native radio
 * buttons in fieldsets: keyboard and screen reader friendly.
 */
export function DiagnosticForm({ questionnaire, locale }: { questionnaire: Questionnaire; locale: "fr" | "en" }) {
  const t = useTranslations("Diagnostic");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const steps = questionnaire.dimensions.length + 1;
  const dimension = step > 0 ? questionnaire.dimensions[step - 1] : undefined;
  const first = useRef(true);

  // Move focus to the new step's title (not on first render).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function next() {
    if (dimension) {
      const notAnswered = unanswered(dimension.questions.map((q) => q.id), answers);
      setMissing(notAnswered);
      if (notAnswered.length) {
        document.getElementById(`question-${notAnswered[0]}`)?.focus();
        return;
      }
    }
    if (step < steps - 1) {
      setStep(step + 1);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitDiagnostic(locale, answers, profile, websiteRef.current?.value ?? "");
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      router.push({ pathname: "/diagnostic/[token]", params: { token: result.data.token } });
    });
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        next();
      }}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {t("progress", { step: step + 1, steps })}
        </p>
        <div aria-hidden="true" className="h-1.5 w-full rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-base" style={{ width: `${Math.round(((step + 1) / steps) * 100)}%` }} />
        </div>
      </div>

      {dimension ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-heading-lg font-semibold focus:outline-none">
              {dimension.label}
            </h2>
            <p className="text-muted-foreground">{dimension.description}</p>
          </div>
          {dimension.questions.map((question, index) => {
            const isMissing = missing.includes(question.id);
            return (
              <fieldset
                key={question.id}
                id={`question-${question.id}`}
                tabIndex={-1}
                aria-describedby={isMissing ? `question-${question.id}-error` : undefined}
                className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5 focus:outline-none", isMissing ? "border-destructive" : "border-border")}
              >
                <legend className="float-left mb-3 w-full font-medium">
                  {index + 1}. {question.label}
                </legend>
                {question.options.map((option) => (
                  <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted has-[:checked]:bg-accent">
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={answers[question.id] === option.id}
                      onChange={() => {
                        setAnswers((previous) => ({ ...previous, [question.id]: option.id }));
                        setMissing((previous) => previous.filter((id) => id !== question.id));
                      }}
                      className="mt-1 size-4 accent-[var(--primary)]"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                {isMissing ? (
                  <p id={`question-${question.id}-error`} className="text-sm font-medium text-destructive">{t("required")}</p>
                ) : null}
              </fieldset>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-heading-lg font-semibold focus:outline-none">{t("profileTitle")}</h2>
            <p className="text-muted-foreground">{t("profileText")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {questionnaire.profile.map((field) => (
              <label key={field.id} className="flex flex-col gap-1.5 text-sm font-medium">
                {field.label}
                <NativeSelect
                  value={profile[field.id] ?? ""}
                  onChange={(event) => setProfile((previous) => ({ ...previous, [field.id]: event.target.value }))}
                >
                  <option value="">{t("notSaid")}</option>
                  {field.options.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </NativeSelect>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Honeypot: invisible to people and assistive technologies, filled in by naive bots. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          {t("honeypot")}
          <input ref={websiteRef} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {missing.length ? <p role="alert" className="text-sm font-medium text-destructive">{t("missing", { count: missing.length })}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-destructive bg-accent p-4 text-sm font-medium text-accent-foreground">{error}</p> : null}

      <div className="flex flex-wrap justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => { setMissing([]); setStep(step - 1); }}>
            <ArrowLeft aria-hidden="true" />
            {t("previous")}
          </Button>
        ) : <span />}
        <Button type="submit" loading={pending}>
          {step === steps - 1 ? t("submit") : t("next")}
          {step === steps - 1 ? null : <ArrowRight aria-hidden="true" />}
        </Button>
      </div>
    </form>
  );
}
