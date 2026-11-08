"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { createProject, type ProjectInput, updateProject } from "@/app/[locale]/admin/portal/actions";
import { usePortalAction } from "@/components/portal/use-portal-action";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { type Person, PROJECT_STATUSES, type ProjectDetail } from "@/lib/portal";

type Props = {
  team: Person[];
  /** Create mode: client organizations to choose from. */
  organizations?: { id: string; name: string; slug: string }[];
  /** Edit mode: the project. */
  project?: ProjectDetail;
};

/** Creates a project for a client organization, or edits one (TASK-097). */
export function ProjectForm({ team, organizations, project }: Props) {
  const t = useTranslations("Admin.portal");
  const tp = useTranslations("Portal");
  const router = useRouter();
  const { pending, error, run } = usePortalAction();
  const [saved, setSaved] = useState(false);
  const creating = !project;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        const input = {
          name: text("name"),
          description: text("description"),
          status: text("status"),
          startDate: text("start_date"),
          dueDate: text("due_date"),
          managerId: text("manager_id"),
        } as ProjectInput;
        if (creating) {
          run(() => createProject(text("organization_id"), input), ({ id }) =>
            router.push({ pathname: "/admin/portal/projects/[id]", params: { id } }),
          );
        } else {
          run(() => updateProject(project.id, input), () => setSaved(true));
        }
      }}
    >
      {creating ? (
        <FormField label={t("create.organization")} required requiredLabel={tp("required")}>
          <NativeSelect name="organization_id" required defaultValue="">
            <option value="" disabled>{t("create.choose")}</option>
            {organizations?.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}
          </NativeSelect>
        </FormField>
      ) : null}
      <FormField label={t("create.name")} required requiredLabel={tp("required")}>
        <Input name="name" required minLength={2} maxLength={160} defaultValue={project?.name} />
      </FormField>
      <FormField label={t("create.description")}>
        <Textarea name="description" maxLength={5000} rows={4} defaultValue={project?.description} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("create.status")}>
          <NativeSelect name="status" defaultValue={project?.status ?? "planned"}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{tp(`projectStatus.${s}`)}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t("create.manager")}>
          <NativeSelect name="manager_id" defaultValue={project?.manager?.id ?? ""}>
            <option value="">{t("create.noManager")}</option>
            {team.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.email}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t("create.start")}>
          <Input name="start_date" type="date" defaultValue={project?.start_date ?? ""} />
        </FormField>
        <FormField label={t("create.due")}>
          <Input name="due_date" type="date" defaultValue={project?.due_date ?? ""} />
        </FormField>
      </div>
      <div>
        <Button type="submit" loading={pending}>{creating ? t("create.submit") : t("project.save")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("project.saved")}</p> : null}
    </form>
  );
}
