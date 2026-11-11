import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { ProjectProgress } from "@/components/portal/progress";
import { StatusChip } from "@/components/portal/status-chip";
import { ProjectForm } from "@/components/portal-admin/project-form";
import { StaffTicketList } from "@/components/portal-admin/ticket-list";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ view?: string }> };

/** Delivery overview: projects of every client and requests waiting for the team (TASK-096). */
export default function PortalAdminPage(props: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalAdmin {...props} />
    </Suspense>
  );
}

async function PortalAdmin({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const all = query.view === "all";
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/portal" }), async (api) => {
    const [dashboard, projects, organizations, team] = await Promise.all([
      api.GET("/api/v1/admin/portal/dashboard"),
      api.GET("/api/v1/admin/portal/projects", { params: { query: { active: !all } } }),
      api.GET("/api/v1/admin/portal/organizations"),
      api.GET("/api/v1/admin/portal/team"),
    ]);
    const data =
      dashboard.data && projects.data && organizations.data && team.data
        ? { dashboard: dashboard.data, projects: projects.data, organizations: organizations.data, team: team.data }
        : undefined;
    return { data, response: dashboard.response };
  });
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, tp, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.portal" }),
    getTranslations({ locale, namespace: "Portal" }),
    getFormatter({ locale }),
  ]);
  const { dashboard, projects, organizations, team } = loaded.data;
  const counts = [
    ["activeProjects", dashboard.active_projects],
    ["pendingDeliverables", dashboard.pending_deliverables],
    ["changesRequested", dashboard.changes_requested],
    ["openTickets", dashboard.open_tickets],
    ["unassigned", dashboard.unassigned_tickets],
    ["urgent", dashboard.urgent_tickets],
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("overview.title")}</h1>
        <p className="text-muted-foreground">{t("overview.lead")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {counts.map(([key, value]) => (
          <li key={key} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <span className="font-heading text-3xl font-semibold">{value}</span>
            <span className="text-sm text-muted-foreground">{t(`overview.counts.${key}`)}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="admin-projects" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="admin-projects" className="text-heading-lg font-semibold">{t("overview.projects")}</h2>
            <nav aria-label={t("overview.filters.label")}>
              <ul className="flex gap-2 text-sm">
                {(["active", "all"] as const).map((view) => (
                  <li key={view}>
                    <Link
                      href={{ pathname: "/admin/portal", query: view === "all" ? { view } : {} }}
                      aria-current={(view === "all") === all ? "page" : undefined}
                      className="inline-flex h-9 items-center rounded-full border border-border px-4 font-medium hover:bg-muted aria-[current=page]:border-secondary aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
                    >
                      {t(`overview.filters.${view}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          {projects.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-input bg-card p-6 text-center text-sm text-muted-foreground">{t("overview.noProject")}</p>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {projects.items.map((project) => (
                <li key={project.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={{ pathname: "/admin/portal/projects/[id]", params: { id: project.id } }}
                        className="text-heading-sm font-semibold underline-offset-4 hover:text-primary-ink hover:underline"
                      >
                        {project.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{t("overview.client", { name: project.organization.name })}</span>
                    </div>
                    <StatusChip value={project.status} label={tp(`projectStatus.${project.status}`)} />
                  </div>
                  <ProjectProgress progress={project.progress} />
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {project.due_date ? <span>{tp("project.due", { date: format.dateTime(new Date(project.due_date), { dateStyle: "medium" }) })}</span> : null}
                    {project.manager ? <span>{tp("project.manager", { name: project.manager.display_name ?? project.manager.email ?? "" })}</span> : null}
                    {project.pending_deliverables > 0 ? (
                      <span>{t("overview.counts.pendingDeliverables")} : {project.pending_deliverables}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="admin-new-project" className="flex flex-col gap-4 self-start rounded-xl border border-border bg-card p-5">
          <h2 id="admin-new-project" className="text-heading-sm font-semibold">{t("create.title")}</h2>
          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("create.noOrganization")}</p>
          ) : (
            <ProjectForm team={team} organizations={organizations} />
          )}
        </section>
      </div>

      <section aria-labelledby="admin-tickets" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="admin-tickets" className="text-heading-lg font-semibold">{t("overview.tickets")}</h2>
          <Link href="/admin/portal/support" className="text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
            {t("overview.allTickets")}
          </Link>
        </div>
        <StaffTicketList tickets={dashboard.tickets} empty={t("overview.noTicket")} />
      </section>
    </div>
  );
}
