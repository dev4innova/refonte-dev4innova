import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { addComment, deleteDocument, listComments, uploadDocument } from "@/app/[locale]/account/portal/actions";
import { Comments } from "@/components/portal/comments";
import { FileList } from "@/components/portal/file-list";
import { PortalHeader } from "@/components/portal/portal-header";
import { ProjectProgress } from "@/components/portal/progress";
import { ReviewForm } from "@/components/portal/review-form";
import { StatusChip } from "@/components/portal/status-chip";
import { UploadForm } from "@/components/portal/upload-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { portalContext } from "@/lib/portal-server";

type Props = { params: Promise<{ locale: Locale; org: string; project: string }> };

/** A project seen by the client: steps, deliverables to review, documents (TASK-097 to TASK-100). */
export default function PortalProjectPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalProject params={params} />
    </Suspense>
  );
}

async function PortalProject({ params }: Props) {
  const { locale, org, project: projectId } = await params;
  const { membership, api } = await portalContext(
    locale,
    { pathname: "/account/portal/[org]/projects/[project]", params: { org, project: projectId } },
    org,
  );
  const { data: project, response } = await api
    .GET("/api/v1/organizations/{organization_id}/portal/projects/{project_id}", {
      params: { path: { organization_id: org, project_id: projectId } },
    })
    .catch(() => ({ data: undefined, response: undefined }));
  if (response?.status === 404 || response?.status === 422) notFound();
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "Portal" }), getFormatter({ locale })]);
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const download = (fileId: string) => `/api/portal/${org}/files/${fileId}`;

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} />
      {!project ? (
        <p role="alert" className="text-destructive">{t("errors.load")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display-md font-semibold">{project.name}</h1>
              <StatusChip value={project.status} label={t(`projectStatus.${project.status}`)} />
            </div>
            <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {project.start_date ? <span>{t("project.start", { date: date(project.start_date) })}</span> : null}
              {project.due_date ? <span>{t("project.due", { date: date(project.due_date) })}</span> : null}
              {project.manager ? <span>{t("project.manager", { name: project.manager.display_name ?? project.manager.email ?? "" })}</span> : null}
            </p>
            <div className="max-w-xl">
              <ProjectProgress progress={project.progress} />
            </div>
            {project.description ? <p className="max-w-3xl whitespace-pre-line">{project.description}</p> : null}
          </div>

          <section aria-labelledby="project-deliverables" className="flex flex-col gap-4">
            <h2 id="project-deliverables" className="text-heading-lg font-semibold">{t("project.deliverables")}</h2>
            {project.deliverables.length === 0 ? (
              <p className="text-muted-foreground">{t("project.noDeliverable")}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {project.deliverables.map((d) => (
                  <li key={d.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-heading-sm font-semibold">{d.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {t("deliverable.version", { version: d.version })} · {t("deliverable.submitted", { date: date(d.updated_at) })}
                        </p>
                      </div>
                      <StatusChip value={d.status} label={t(`deliverableStatus.${d.status}`)} />
                    </div>
                    {d.description ? <p className="text-sm whitespace-pre-line">{d.description}</p> : null}
                    {d.file ? (
                      <a
                        href={download(d.file.id)}
                        className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium break-all hover:border-primary hover:text-primary"
                      >
                        <Download aria-hidden="true" className="size-4 shrink-0" />
                        {t("deliverable.downloadName", { name: d.file.name })}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("deliverable.noFile")}</p>
                    )}
                    {d.reviewed_by && d.reviewed_at && d.status !== "pending_review" ? (
                      <p className="text-sm">
                        {t("deliverable.reviewed", {
                          decision: d.status,
                          name: d.reviewed_by.display_name ?? d.reviewed_by.email ?? t("deletedUser"),
                          date: date(d.reviewed_at),
                        })}
                      </p>
                    ) : null}
                    {d.status === "pending_review" ? (
                      project.can_review ? (
                        <ReviewForm org={org} deliverableId={d.id} />
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("deliverable.reviewOnlyAdmins")}</p>
                      )
                    ) : null}
                    <Comments
                      name={d.title}
                      count={d.comments}
                      load={listComments.bind(null, org, "deliverable", d.id)}
                      add={addComment.bind(null, org, "deliverable", d.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="project-tasks" className="flex flex-col gap-4">
            <h2 id="project-tasks" className="text-heading-lg font-semibold">{t("project.tasks")}</h2>
            {project.tasks.length === 0 ? (
              <p className="text-muted-foreground">{t("project.noTask")}</p>
            ) : (
              <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                {project.tasks.map((task) => (
                  <li key={task.id} className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <h3 className="font-semibold">{task.title}</h3>
                        {task.due_date ? <span className="text-xs text-muted-foreground">{t("project.due", { date: date(task.due_date) })}</span> : null}
                      </div>
                      <StatusChip value={task.status} label={t(`taskStatus.${task.status}`)} />
                    </div>
                    {task.description ? <p className="text-sm whitespace-pre-line text-muted-foreground">{task.description}</p> : null}
                    <Comments
                      name={task.title}
                      count={task.comments}
                      load={listComments.bind(null, org, "task", task.id)}
                      add={addComment.bind(null, org, "task", task.id)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="project-documents" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="project-documents" className="text-heading-lg font-semibold">{t("project.documents")}</h2>
              <Link
                href={{ pathname: "/account/portal/[org]/documents", params: { org } }}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("project.allDocuments")}
              </Link>
            </div>
            <FileList
              files={project.documents}
              empty={t("project.noDocument")}
              href={(file) => download(file.id)}
              remove={(file) => deleteDocument.bind(null, org, file.id)}
            />
            <div className="max-w-xl rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-heading-sm font-semibold">{t("documents.upload")}</h3>
              <UploadForm action={uploadDocument.bind(null, org)} projectId={project.id} submitLabel={t("documents.submit")} />
            </div>
          </section>

          <Link
            href={{ pathname: "/account/portal/[org]", params: { org } }}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("nav.dashboard")}
          </Link>
        </>
      )}
    </>
  );
}
