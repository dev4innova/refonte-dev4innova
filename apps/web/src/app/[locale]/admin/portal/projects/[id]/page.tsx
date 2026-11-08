import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  addComment,
  deleteDeliverable,
  deleteDocument,
  deleteTask,
  listComments,
  shareDocument,
  submitDeliverable,
  submitVersion,
} from "@/app/[locale]/admin/portal/actions";
import { AdminNotice } from "@/components/admin/admin-notice";
import { Comments } from "@/components/portal/comments";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { FileList } from "@/components/portal/file-list";
import { ProjectProgress } from "@/components/portal/progress";
import { StatusChip } from "@/components/portal/status-chip";
import { UploadForm } from "@/components/portal/upload-form";
import { DeleteProjectButton } from "@/components/portal-admin/delete-project";
import { ProjectForm } from "@/components/portal-admin/project-form";
import { NewTaskForm, TaskStatusSelect } from "@/components/portal-admin/task-controls";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { isUuid } from "@/lib/sse-relay";

type Props = { params: Promise<{ locale: Locale; id: string }> };

/** A client project in the back office: details, tasks, deliverables, documents (TASK-097 to TASK-100). */
export default function PortalAdminProjectPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalAdminProject params={params} />
    </Suspense>
  );
}

async function PortalAdminProject({ params }: Props) {
  const { locale, id } = await params;
  if (!isUuid(id)) notFound();
  const loaded = await adminLoad(getPathname({ locale, href: { pathname: "/admin/portal/projects/[id]", params: { id } } }), async (api) => {
    const [project, team] = await Promise.all([
      api.GET("/api/v1/admin/portal/projects/{project_id}", { params: { path: { project_id: id } } }),
      api.GET("/api/v1/admin/portal/team"),
    ]);
    return { data: project.data && team.data ? { project: project.data, team: team.data } : undefined, response: project.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tp, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.portal" }),
    getTranslations({ locale, namespace: "Portal" }),
    getFormatter({ locale }),
  ]);
  const { project, team } = loaded.data;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const download = (fileId: string) => `/api/admin/portal/files/${fileId}`;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/admin/portal" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("project.back")}
      </Link>
      <div className="flex flex-col gap-3">
        <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary uppercase">{project.organization.name}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-md font-semibold">{project.name}</h1>
          <StatusChip value={project.status} label={tp(`projectStatus.${project.status}`)} />
        </div>
        <p className="text-sm text-muted-foreground">{t("project.clientView")}</p>
        <div className="max-w-xl">
          <ProjectProgress progress={project.progress} />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="admin-tasks" className="flex flex-col gap-4">
            <h2 id="admin-tasks" className="text-heading-lg font-semibold">{t("project.tasks.title")}</h2>
            {project.tasks.length === 0 ? (
              <p className="text-muted-foreground">{t("project.tasks.empty")}</p>
            ) : (
              <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                {project.tasks.map((task) => (
                  <li key={task.id} className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <h3 className="font-semibold">{task.title}</h3>
                        {task.due_date ? <span className="text-xs text-muted-foreground">{tp("project.due", { date: date(task.due_date) })}</span> : null}
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <TaskStatusSelect taskId={task.id} status={task.status} name={task.title} />
                        <ConfirmButton
                          action={deleteTask.bind(null, task.id)}
                          label={t("project.tasks.deleteName", { name: task.title })}
                          confirm={t("project.tasks.deleteConfirm", { name: task.title })}
                        >
                          {t("project.tasks.delete")}
                        </ConfirmButton>
                      </div>
                    </div>
                    {task.description ? <p className="text-sm whitespace-pre-line text-muted-foreground">{task.description}</p> : null}
                    <Comments
                      name={task.title}
                      count={task.comments}
                      load={listComments.bind(null, "task", task.id)}
                      add={addComment.bind(null, "task", task.id)}
                    />
                  </li>
                ))}
              </ol>
            )}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-heading-sm font-semibold">{t("project.tasks.add")}</h3>
              <NewTaskForm projectId={project.id} />
            </div>
          </section>

          <section aria-labelledby="admin-deliverables" className="flex flex-col gap-4">
            <h2 id="admin-deliverables" className="text-heading-lg font-semibold">{t("project.deliverables.title")}</h2>
            {project.deliverables.length === 0 ? (
              <p className="text-muted-foreground">{t("project.deliverables.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {project.deliverables.map((d) => (
                  <li key={d.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-heading-sm font-semibold">{d.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {tp("deliverable.version", { version: d.version })} · {tp("deliverable.submitted", { date: date(d.updated_at) })}
                        </p>
                      </div>
                      <StatusChip value={d.status} label={tp(`deliverableStatus.${d.status}`)} />
                    </div>
                    {d.file ? (
                      <a href={download(d.file.id)} className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium break-all hover:border-primary hover:text-primary">
                        <Download aria-hidden="true" className="size-4 shrink-0" />
                        {tp("deliverable.downloadName", { name: d.file.name })}
                      </a>
                    ) : null}
                    {d.reviewed_by && d.reviewed_at && d.status !== "pending_review" ? (
                      <p className="text-sm">
                        {tp("deliverable.reviewed", {
                          decision: d.status,
                          name: d.reviewed_by.display_name ?? d.reviewed_by.email ?? tp("deletedUser"),
                          date: date(d.reviewed_at),
                        })}
                        {d.review_comment ? <> : « {d.review_comment} »</> : null}
                      </p>
                    ) : null}
                    <Comments
                      name={d.title}
                      count={d.comments}
                      load={listComments.bind(null, "deliverable", d.id)}
                      add={addComment.bind(null, "deliverable", d.id)}
                    />
                    <div className="flex flex-wrap items-start gap-4">
                      {d.status !== "approved" ? (
                        <details className="min-w-0 flex-1 rounded-lg border border-border p-3">
                          <summary className="cursor-pointer text-sm font-medium">{t("project.deliverables.newVersionOf", { name: d.title })}</summary>
                          <p className="mt-2 text-xs text-muted-foreground">{t("project.deliverables.versionHelp")}</p>
                          <div className="mt-3">
                            <UploadForm action={submitVersion.bind(null, d.id)} submitLabel={t("project.deliverables.sendVersion")} />
                          </div>
                        </details>
                      ) : null}
                      <ConfirmButton
                        action={deleteDeliverable.bind(null, d.id)}
                        label={t("project.deliverables.deleteName", { name: d.title })}
                        confirm={t("project.deliverables.deleteConfirm", { name: d.title })}
                      >
                        {t("project.deliverables.delete")}
                      </ConfirmButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-heading-sm font-semibold">{t("project.deliverables.submit")}</h3>
              <UploadForm action={submitDeliverable.bind(null, project.id)} submitLabel={t("project.deliverables.send")}>
                <FormField label={t("project.deliverables.name")} required requiredLabel={tp("required")}>
                  <Input name="title" required minLength={2} maxLength={200} />
                </FormField>
                <FormField label={t("project.deliverables.description")}>
                  <Textarea name="description" maxLength={5000} rows={2} />
                </FormField>
              </UploadForm>
            </div>
          </section>

          <section aria-labelledby="admin-documents" className="flex flex-col gap-4">
            <h2 id="admin-documents" className="text-heading-lg font-semibold">{t("project.documents.title")}</h2>
            <FileList
              files={project.documents}
              empty={t("project.documents.empty")}
              href={(file) => download(file.id)}
              remove={(file) => deleteDocument.bind(null, file.id)}
            />
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-heading-sm font-semibold">{t("project.documents.share")}</h3>
              <UploadForm
                action={shareDocument.bind(null, project.organization.id)}
                projectId={project.id}
                submitLabel={t("project.documents.submit")}
              />
            </div>
          </section>
        </div>

        <aside aria-labelledby="admin-project-details" className="flex flex-col gap-4 self-start rounded-xl border border-border bg-card p-5">
          <h2 id="admin-project-details" className="text-heading-sm font-semibold">{t("project.details")}</h2>
          <ProjectForm team={team} project={project} />
          <DeleteProjectButton projectId={project.id} name={project.name} />
        </aside>
      </div>
    </div>
  );
}

