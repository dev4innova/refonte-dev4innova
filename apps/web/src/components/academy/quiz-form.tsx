"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { submitQuiz } from "@/app/[locale]/account/academy/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { QuizResult, QuizView } from "@/lib/academy";
import { cn } from "@/lib/utils";

/** A module quiz (TASK-108): answers are graded by the server, then explained. */
export function QuizForm({ quiz, locale }: { quiz: QuizView; locale: "fr" | "en" }) {
  const t = useTranslations("Academy");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = useRef<HTMLDivElement>(null);
  const unanswered = quiz.questions.filter((q) => answers[q.id] === undefined).length;
  const outcome = new Map(result?.results.map((r) => [r.question_id, r]));

  function send() {
    startTransition(async () => {
      setError(null);
      const response = await submitQuiz(quiz.module_id, answers, locale);
      if (!response.ok) {
        setError(t(`errors.${response.error}`));
        return;
      }
      setResult(response.data);
      setConfirming(false);
      requestAnimationFrame(() => summary.current?.focus());
    });
  }

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (unanswered > 0 && !confirming) {
          setConfirming(true);
          return;
        }
        send();
      }}
    >
      {result ? (
        <div
          ref={summary}
          tabIndex={-1}
          role="status"
          className={cn("flex flex-col gap-2 rounded-xl border p-5 outline-none", result.passed ? "border-primary/40 bg-accent/40" : "border-border bg-muted")}
        >
          <p className="text-heading-sm font-semibold">{result.passed ? t("quiz.passed") : t("quiz.score", { score: result.score })}</p>
          {result.passed ? <p>{t("quiz.score", { score: result.score })}</p> : <p>{t("quiz.failed", { percent: result.pass_percent })}</p>}
          {result.course_completed && result.certificate_code ? (
            <Link
              href={{ pathname: "/academy/certificate/[code]", params: { code: result.certificate_code } }}
              className="font-semibold text-primary-ink underline-offset-4 hover:underline"
            >
              {t("lesson.certificate")}
            </Link>
          ) : null}
        </div>
      ) : null}
      <ol className="flex flex-col gap-6">
        {quiz.questions.map((question, index) => {
          const graded = outcome.get(question.id);
          return (
            <li key={question.id}>
              <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <legend className="float-left mb-2 w-full font-semibold">
                  <span className="block text-xs font-semibold tracking-wide text-primary-ink uppercase">{t("quiz.question", { number: index + 1 })}</span>
                  {question.prompt}
                </legend>
                {question.options.map((option, optionIndex) => {
                  const right = graded && graded.correct_option === optionIndex;
                  const chosenWrong = graded && graded.chosen === optionIndex && !graded.correct;
                  return (
                    <label
                      key={optionIndex}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary",
                        right && "border-2 border-primary bg-accent/40",
                        chosenWrong && "border-dashed border-destructive",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={optionIndex}
                        checked={answers[question.id] === optionIndex}
                        disabled={result !== null}
                        onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span className="flex-1">{option}</span>
                      {right ? <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary-ink" /> : null}
                      {chosenWrong ? <XCircle aria-hidden="true" className="size-5 shrink-0 text-destructive" /> : null}
                    </label>
                  );
                })}
                {graded ? (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className={cn("inline-flex items-center gap-1.5 font-semibold", graded.correct ? "text-foreground" : "text-destructive")}>
                      {graded.correct ? <CheckCircle2 aria-hidden="true" className="size-4 text-primary-ink" /> : <XCircle aria-hidden="true" className="size-4" />}
                      {graded.correct ? t("quiz.correct") : t("quiz.wrong")}
                    </p>
                    {!graded.correct ? <p>{t("quiz.rightAnswer", { answer: question.options[graded.correct_option] ?? "" })}</p> : null}
                    {graded.explanation ? <p className="text-muted-foreground">{graded.explanation}</p> : null}
                  </div>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {result ? (
        <div className="flex flex-wrap gap-3">
          {!result.passed ? (
            <Button type="button" onClick={() => { setResult(null); setAnswers({}); }}>
              {t("quiz.retry")}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={{ pathname: "/account/academy/[course]", params: { course: quiz.course_slug } }}>{t("quiz.back")}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {confirming ? <p role="alert" className="text-sm font-medium">{t("quiz.unanswered", { count: unanswered })}</p> : null}
          <div>
            <Button type="submit" size="lg" loading={pending}>
              {confirming ? t("quiz.confirm") : t("quiz.submit")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
