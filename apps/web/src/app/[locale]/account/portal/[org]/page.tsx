import { CalendarClock, FileCheck2, FolderKanban, LifeBuoy, ListChecks } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PortalHeader } from "@/components/portal/portal-header";
import { ProjectProgress } from "@/components/portal/progress";
import { StatusChip } from "@/components/portal/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { portalContext } from "@/lib/portal-server";

type Props = { params: Promise<{ locale: Locale; org: string }> };

/** Portal home of an organization (TASK-096). */
export default function PortalDashboardPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalDashboard params={params} />
    </Suspense>
  );
}

async function PortalDashboard({ params }: Props) {
  const { locale, org } = await params;
  const { membership, api } = await portalContext(locale, { pathname: "/account/portal/[org]", params: { org } }, org);
  const [t, format, dashboard] = await Promise.all([
    getTranslations({ locale, namespace: "Portal" }),
    getFormatter({ locale }),
    api
      .GET("/api/v1/organizations/{organization_id}/portal/dashboard", { params: { path: { organization_id: org } } })
      .then((r) => r.data)
      .catch(() => undefined),
  ]);
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });

  const counts = dashboard
    ? [
        { key: "activeProjects", value: dashboard.counts.active_projects, icon: FolderKanban },
        { key: "tasksInReview", value: dashboard.counts.tasks_in_review, icon: ListChecks },
        { key: "pendingDeliverables", value: dashboard.counts.pending_deliverables, icon: FileCheck2 },
        { key: "openTickets", value: dashboard.counts.open_tickets, icon: LifeBuoy },
      ] as const
    : [];

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} role={membership.role} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("dashboard.title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("dashboard.lead")}</p>
      </div>
      {!dashboard ? (
        <p role="alert" className="text-destructive">{t("errors.load")}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {counts.map(({ key, value, icon: Icon }) => (
              <li key={key} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                <Icon aria-hidden="true" className="size-5 text-primary" />
                <span className="font-heading text-3xl font-semibold">{value}</span>
                <span className="text-sm text-muted-foreground">{t(`dashboard.counts.${key}`)}</span>
              </li>
            ))}
          </ul>

          <section aria-labelledby="portal-projects" className="flex flex-col gap-4">
            <h2 id="portal-projects" className="text-heading-lg font-semibold">{t("dashboard.projects")}</h2>
            {dashboard.projects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-input bg-card p-8 text-center text-muted-foreground">{t("dashboard.noProject")}</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {dashboard.projects.map((project) => (
                  <li key={project.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-heading-sm font-semibold">
                        <Link
                          href={{ pathname: "/account/portal/[org]/projects/[project]", params: { org, project: project.id } }}
                          className="underline-offset-4 hover:text-primary hover:underline"
                        >
                          {project.name}
                        </Link>
                      </h3>
                      <StatusChip value={project.status} label={t(`projectStatus.${project.status}`)} />
                    </div>
                    <ProjectProgress progress={project.progress} />
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {project.due_date ? <span>{t("project.due", { date: date(project.due_date) })}</span> : null}
                      {project.manager ? <span>{t("project.manager", { name: project.manager.display_name ?? project.manager.email ?? "" })}</span> : null}
                      {project.pending_deliverables > 0 ? (
                        <span className="font-semibold text-primary">
                          {t("dashboard.counts.pendingDeliverables")} : {project.pending_deliverables}
                        </span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="portal-review" className="flex flex-col gap-3">
              <h2 id="portal-review" className="text-heading-sm font-semibold">{t("dashboard.toReview")}</h2>
              {dashboard.pending_deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.noDeliverable")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                  {dashboard.pending_deliverables.map((d) => (
                    <li key={d.id} className="flex flex-col gap-0.5 p-4">
                      <Link
                        href={{ pathname: "/account/portal/[org]/projects/[project]", params: { org, project: d.project_id } }}
                        className="font-medium underline-offset-4 hover:text-primary hover:underline"
                      >
                        {d.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {d.project_name} · {t("dashboard.version", { version: d.version })} · {date(d.updated_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="portal-upcoming" className="flex flex-col gap-3">
              <h2 id="portal-upcoming" className="text-heading-sm font-semibold">{t("dashboard.upcoming")}</h2>
              {dashboard.upcoming_tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.noTask")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                  {dashboard.upcoming_tasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={{ pathname: "/account/portal/[org]/projects/[project]", params: { org, project: task.project_id } }}
                          className="font-medium underline-offset-4 hover:text-primary hover:underline"
                        >
                          {task.title}
                        </Link>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {task.project_name}
                          {task.due_date ? (
                            <>
                              {" · "}
                              <CalendarClock aria-hidden="true" className="size-3.5" />
                              {t("project.due", { date: date(task.due_date) })}
                            </>
                          ) : null}
                        </span>
                      </div>
                      <StatusChip value={task.status} label={t(`taskStatus.${task.status}`)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="portal-tickets" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="portal-tickets" className="text-heading-sm font-semibold">{t("dashboard.tickets")}</h2>
              <Button asChild size="sm" variant="secondary">
                <Link href={{ pathname: "/account/portal/[org]/support", params: { org } }}>{t("dashboard.newTicket")}</Link>
              </Button>
            </div>
            {dashboard.recent_tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noTicket")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
                {dashboard.recent_tickets.map((ticket) => (
                  <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={{ pathname: "/account/portal/[org]/support/[ticket]", params: { org, ticket: ticket.id } }}
                        className="font-medium underline-offset-4 hover:text-primary hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {t("support.number", { number: ticket.number })} · {t("support.updated", { date: date(ticket.last_message_at) })}
                      </span>
                    </div>
                    <StatusChip value={ticket.status} label={t(`ticketStatus.${ticket.status}`)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
