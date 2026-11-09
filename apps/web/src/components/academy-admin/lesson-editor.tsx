"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { previewMarkdown } from "@/app/[locale]/admin/actions";
import { updateLesson } from "@/app/[locale]/admin/academy/actions";
import { Prose } from "@/components/cms/prose";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { type AdminLesson, textsFrom } from "@/lib/academy";

import { BilingualField } from "./bilingual";
import { useAcademyAction } from "./use-academy-action";

/** Lesson editor: title and Markdown content in both languages, video, duration, preview (TASK-105). */
export function LessonEditor({ lesson }: { lesson: AdminLesson }) {
  const t = useTranslations("Admin.academy");
  const { pending, error, run } = useAcademyAction();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<{ fr: string; en: string } | null>(null);
  const [previewing, startPreview] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        run(
          () =>
            updateLesson(lesson.id, {
              title: textsFrom(data, "title"),
              bodyMd: textsFrom(data, "body"),
              videoUrl: String(data.get("video") ?? ""),
              durationMinutes: Number(data.get("duration") ?? 5),
            }),
          () => setSaved(true),
        );
      }}
    >
      <BilingualField name="title" label={t("outline.lessonTitle")} defaultValue={lesson.title} maxLength={200} required />
      <BilingualField name="body" label={t("lesson.body")} defaultValue={lesson.body_md} maxLength={50000} multiline={14} code />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <FormField label={t("lesson.video")} description={t("lesson.videoHelp")}>
          <Input name="video" type="url" maxLength={300} defaultValue={lesson.video_url ?? ""} placeholder="https://www.youtube.com/watch?v=…" />
        </FormField>
        <FormField label={t("lesson.duration")}>
          <Input name="duration" type="number" min={1} max={600} defaultValue={lesson.duration_minutes} />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>{t("lesson.save")}</Button>
        <Button
          type="button"
          variant="outline"
          loading={previewing}
          onClick={() =>
            startPreview(async () => {
              if (!form.current) return;
              const body = textsFrom(new FormData(form.current), "body");
              const [fr, en] = await Promise.all([previewMarkdown(body.fr), previewMarkdown(body.en)]);
              setPreview({ fr: fr.ok ? fr.data : "", en: en.ok ? en.data : "" });
            })
          }
        >
          {t("lesson.preview")}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("course.saved")}</p> : null}
      {preview ? (
        <section aria-label={t("lesson.preview")} className="grid gap-4 md:grid-cols-2">
          {(["fr", "en"] as const).map((locale) => (
            <div key={locale} lang={locale} className="min-w-0 rounded-xl border border-border bg-card p-5">
              <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase">{t(locale)}</p>
              <Prose html={preview[locale]} />
            </div>
          ))}
        </section>
      ) : null}
    </form>
  );
}
