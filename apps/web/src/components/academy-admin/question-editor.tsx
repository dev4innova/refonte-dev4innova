"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { saveQuestion } from "@/app/[locale]/admin/academy/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { type AdminQuestion, textsFrom } from "@/lib/academy";

import { BilingualField } from "./bilingual";
import { useAcademyAction } from "./use-academy-action";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** A single-choice question: text, 2 to 6 answers in both languages, the right one, an explanation (TASK-108). */
export function QuestionEditor({ moduleId, question }: { moduleId: string; question?: AdminQuestion }) {
  const t = useTranslations("Admin.academy");
  const { pending, error, run } = useAcademyAction();
  const [count, setCount] = useState(question?.options.length ?? 3);
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        const options = Array.from({ length: count }, (_, i) => textsFrom(data, `option${i}`));
        run(
          () =>
            saveQuestion(question ? { questionId: question.id } : { moduleId }, {
              prompt: textsFrom(data, "prompt"),
              options,
              correctOption: Number(data.get("correct") ?? 0),
              explanation: textsFrom(data, "explanation"),
            }),
          () => {
            setSaved(true);
            if (!question) {
              form.current?.reset();
              setCount(3);
            }
          },
        );
      }}
    >
      <BilingualField name="prompt" label={t("quiz.prompt")} defaultValue={question?.prompt} maxLength={600} multiline={2} required />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("quiz.correct")}</legend>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3 has-[:checked]:border-primary">
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input type="radio" name="correct" value={i} defaultChecked={(question?.correct_option ?? 0) === i} className="size-4 accent-primary" />
              {t("quiz.option", { letter: LETTERS[i] ?? String(i + 1) })}
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              {(["fr", "en"] as const).map((locale) => (
                <FormField key={locale} label={`${t("quiz.option", { letter: LETTERS[i] ?? String(i + 1) })} (${t(locale)})`}>
                  <Input name={`option${i}_${locale}`} lang={locale} maxLength={300} defaultValue={question?.options[i]?.[locale] ?? ""} required={locale === "fr" && i < 2} />
                </FormField>
              ))}
            </div>
          </div>
        ))}
        {count < 6 ? (
          <div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCount(count + 1)}>
              <Plus aria-hidden="true" />
              {t("quiz.addOption")}
            </Button>
          </div>
        ) : null}
      </fieldset>
      <BilingualField name="explanation" label={t("quiz.explanation")} defaultValue={question?.explanation} maxLength={600} multiline={2} />
      <div>
        <Button type="submit" variant={question ? "secondary" : "primary"} loading={pending}>{question ? t("quiz.save") : t("quiz.add")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("course.saved")}</p> : null}
    </form>
  );
}
