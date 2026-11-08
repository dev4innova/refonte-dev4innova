"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { createTask, setTaskStatus } from "@/app/[locale]/admin/portal/actions";
import { usePortalAction } from "@/components/portal/use-portal-action";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_STATUSES, type TaskStatus } from "@/lib/portal";

/** Adds a task to a project (TASK-098). */
export function NewTaskForm({ projectId }: { projectId: string }) {
  const t = useTranslations("Admin.portal.project.tasks");
  const tp = useTranslations("Portal");
  const { pending, error, run } = usePortalAction();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        run(
          () =>
            createTask(projectId, {
              title: text("title"),
              description: text("description"),
              status: text("status") as TaskStatus,
              dueDate: text("due_date"),
            }),
          () => form.current?.reset(),
        );
      }}
    >
      <FormField label={t("name")} required requiredLabel={tp("required")}>
        <Input name="title" required minLength={2} maxLength={200} />
      </FormField>
      <FormField label={t("description")}>
        <Textarea name="description" maxLength={5000} rows={2} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("status")} description={t("reviewHint")}>
          <NativeSelect name="status" defaultValue="todo">
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{tp(`taskStatus.${s}`)}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t("due")}>
          <Input name="due_date" type="date" />
        </FormField>
      </div>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("submit")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}

/** Status of a task, saved as soon as it changes. */
export function TaskStatusSelect({ taskId, status, name }: { taskId: string; status: TaskStatus; name: string }) {
  const t = useTranslations("Admin.portal.project.tasks");
  const tp = useTranslations("Portal");
  const id = useId();
  const { pending, error, run } = usePortalAction();
  const [current, setCurrent] = useState(status);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">{t("changeStatus", { name })}</label>
      <NativeSelect
        id={id}
        size="sm"
        value={current}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          const next = event.target.value as TaskStatus;
          const previous = current;
          setCurrent(next);
          run(async () => {
            const result = await setTaskStatus(taskId, next);
            if (!result.ok) setCurrent(previous);
            return result;
          });
        }}
      >
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{tp(`taskStatus.${s}`)}</option>)}
      </NativeSelect>
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
