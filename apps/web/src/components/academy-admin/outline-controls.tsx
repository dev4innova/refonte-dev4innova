"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { createLesson, deleteItem, type ItemKind, moveItem, saveModule } from "@/app/[locale]/admin/academy/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { textsFrom, type Texts } from "@/lib/academy";

import { BilingualField } from "./bilingual";
import { useAcademyAction } from "./use-academy-action";

/** Up, down and delete buttons of a module, a lesson or a question. */
export function ItemActions({ kind, id, name, first, last, confirm }: { kind: ItemKind; id: string; name: string; first: boolean; last: boolean; confirm: string }) {
  const t = useTranslations("Admin.academy.outline");
  const { pending, error, run } = useAcademyAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex gap-1">
        <Button type="button" size="icon" variant="ghost" className="size-9" disabled={first || pending} aria-label={t("upName", { name })} onClick={() => run(() => moveItem(kind, id, "up"))}>
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="size-9" disabled={last || pending} aria-label={t("downName", { name })} onClick={() => run(() => moveItem(kind, id, "down"))}>
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9"
          disabled={pending}
          aria-label={t("deleteName", { name })}
          onClick={() => {
            if (window.confirm(confirm)) run(() => deleteItem(kind, id));
          }}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </span>
      {error ? <span role="alert" className="text-xs font-medium text-destructive">{error}</span> : null}
    </span>
  );
}

/** Adds a module to a course, or edits one. */
export function ModuleForm({ courseId, module }: { courseId: string; module?: { id: string; title: Texts; summary: Texts } }) {
  const t = useTranslations("Admin.academy");
  const { pending, error, run } = useAcademyAction();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const input = { title: textsFrom(data, "module_title"), summary: textsFrom(data, "module_summary") };
        run(() => saveModule(module ? { moduleId: module.id } : { courseId }, input), () => {
          if (!module) form.current?.reset();
        });
      }}
    >
      <BilingualField name="module_title" label={t("outline.moduleTitle")} defaultValue={module?.title} maxLength={200} required />
      <BilingualField name="module_summary" label={t("outline.moduleSummary")} defaultValue={module?.summary} maxLength={600} multiline={2} />
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          {module ? t("course.save") : t("outline.addModule")}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}

/** Adds a lesson by its title, then opens its editor. */
export function AddLessonForm({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const t = useTranslations("Admin.academy.outline");
  const router = useRouter();
  const { pending, error, run } = useAcademyAction();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          {t("addLesson")}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const title = textsFrom(new FormData(event.currentTarget), "lesson_title");
        run(() => createLesson(moduleId, title), ({ id }) =>
          router.push({ pathname: "/admin/academy/[id]/lessons/[lesson]", params: { id: courseId, lesson: id } }),
        );
      }}
    >
      <BilingualField name="lesson_title" label={t("lessonTitle")} maxLength={200} required />
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>{t("addLesson")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}
