"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { type CourseInput, createCourse, updateCourse } from "@/app/[locale]/admin/academy/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useRouter } from "@/i18n/navigation";
import { type AdminCourse, LEVELS, type Level, textsFrom, VISIBILITIES, type Visibility } from "@/lib/academy";

import { BilingualField } from "./bilingual";
import { useAcademyAction } from "./use-academy-action";

/** Creates a course (draft) or edits its presentation (TASK-103). */
export function CourseForm({ course }: { course?: AdminCourse }) {
  const t = useTranslations("Admin.academy");
  const tLevels = useTranslations("Academy.levels");
  const router = useRouter();
  const { pending, error, run } = useAcademyAction();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        const input: CourseInput = {
          slug: String(data.get("slug") ?? ""),
          visibility: String(data.get("visibility")) as Visibility,
          level: String(data.get("level")) as Level,
          durationMinutes: Number(data.get("duration") ?? 0),
          title: textsFrom(data, "title"),
          summary: textsFrom(data, "summary"),
          descriptionMd: textsFrom(data, "description"),
        };
        if (course) run(() => updateCourse(course.id, input), () => setSaved(true));
        else run(() => createCourse(input), ({ id }) => router.push({ pathname: "/admin/academy/[id]", params: { id } }));
      }}
    >
      <BilingualField name="title" label={t("course.titleField")} defaultValue={course?.title} maxLength={200} required />
      <BilingualField name="summary" label={t("course.summary")} defaultValue={course?.summary} maxLength={600} multiline={2} />
      {course ? (
        <BilingualField name="description" label={t("course.description")} defaultValue={course.description_md} maxLength={50000} multiline={6} code />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label={t("course.slug")} description={t("course.slugHelp", { slug: "…" })} required requiredLabel={t("required")}>
          <Input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={120} defaultValue={course?.slug} />
        </FormField>
        <FormField label={t("course.visibilityField")}>
          <NativeSelect name="visibility" defaultValue={course?.visibility ?? "public"}>
            {VISIBILITIES.map((v) => <option key={v} value={v}>{t(`visibility.${v}`)}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t("course.level")}>
          <NativeSelect name="level" defaultValue={course?.level ?? "beginner"}>
            {LEVELS.map((l) => <option key={l} value={l}>{tLevels(l)}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t("course.duration")}>
          <Input name="duration" type="number" min={0} max={100000} defaultValue={course?.duration_minutes ?? 60} />
        </FormField>
      </div>
      <div>
        <Button type="submit" loading={pending}>{course ? t("course.save") : t("course.create")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("course.saved")}</p> : null}
    </form>
  );
}
