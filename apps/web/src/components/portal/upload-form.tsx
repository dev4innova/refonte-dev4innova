"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FILE_ACCEPT } from "@/lib/portal";
import type { PortalResult } from "@/lib/portal-actions";

import { usePortalAction } from "./use-portal-action";

type Props = {
  action: (formData: FormData) => Promise<PortalResult>;
  submitLabel: string;
  /** Lets the sender attach the file to a project. */
  projects?: { id: string; name: string }[];
  /** Fixed project (hidden field). */
  projectId?: string;
  /** Extra fields shown before the file (deliverable title...). */
  children?: React.ReactNode;
};

/** Sends a file (and optional fields) to a portal Server Action, then refreshes the page. */
export function UploadForm({ action, submitLabel, projects, projectId, children }: Props) {
  const t = useTranslations("Portal");
  const { pending, error, run } = usePortalAction();
  const [sent, setSent] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSent(false);
        const data = new FormData(event.currentTarget);
        run(() => action(data), () => {
          form.current?.reset();
          setSent(true);
        });
      }}
    >
      {children}
      {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
      {projects && projects.length > 0 ? (
        <FormField label={t("documents.project")}>
          <NativeSelect name="project_id" defaultValue="">
            <option value="">{t("documents.noProject")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </NativeSelect>
        </FormField>
      ) : null}
      <FormField label={t("documents.file")} description={t("documents.fileHelp")} required requiredLabel={t("required")}>
        <Input
          name="file"
          type="file"
          accept={FILE_ACCEPT}
          required
          className="h-auto py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
      </FormField>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{submitLabel}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {sent && !error ? <p role="status" className="text-sm text-muted-foreground">{t("documents.uploaded")}</p> : null}
    </form>
  );
}
