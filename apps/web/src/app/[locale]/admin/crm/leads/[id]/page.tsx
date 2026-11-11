import { ArrowLeft, CalendarDays, ClipboardCheck, FileText, Mail, MessageSquare, Phone, RefreshCw, StickyNote, UserRound, Users } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { ActivityForm } from "@/components/crm/activity-form";
import { CrmBadge } from "@/components/crm/crm-badge";
import {
  DeleteLeadButton,
  LeadDetailsForm,
  LeadOwnerSelect,
  LeadStatusSelect,
  QuoteStatusSelect,
  StageSelect,
} from "@/components/crm/lead-controls";
import { NewOpportunityForm, OpportunityValueForm } from "@/components/crm/opportunity-form";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad, getStaffRole, staffAccess } from "@/lib/admin";
import { getContentList } from "@/lib/cms";
import { type Activity, type Person, personLabel } from "@/lib/crm";

type Props = { params: Promise<{ locale: Locale; id: string }> };

/** A prospect: details, timeline, opportunities and quote requests (TASK-067 to TASK-072). */
export default function LeadPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-[40rem] animate-pulse rounded-xl bg-muted" />}>
      <Lead params={params} />
    </Suspense>
  );
}

const ICONS = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Users,
  contact_message: MessageSquare,
  quote_request: FileText,
  diagnostic: ClipboardCheck,
  status_change: RefreshCw,
  stage_change: RefreshCw,
  assignment: UserRound,
} as const;

async function Lead({ params }: Props) {
  const { locale, id } = await params;
  const returnTo = getPathname({ locale, href: { pathname: "/admin/crm/leads/[id]", params: { id } } });
  const loaded = await adminLoad(returnTo, (api) =>
    api.GET("/api/v1/admin/crm/leads/{lead_id}", { params: { path: { lead_id: id } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const lead = loaded.data;
  const [t, tQuote, format, team, role, services] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.crm" }),
    getTranslations({ locale, namespace: "Quote" }),
    getFormatter({ locale }),
    adminLoad(returnTo, (api) => api.GET("/api/v1/admin/crm/team")).then((r) => (r.ok ? r.data : [])),
    getStaffRole(loaded.session.accessToken),
    getContentList("service", locale),
  ]);
  const access = staffAccess(role);
  const people = new Map<string, Person>(team.map((p) => [p.id, p]));
  const money = (amount: string | null | undefined) =>
    amount === null || amount === undefined
      ? "—"
      : format.number(Number(amount), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
  const name = (personId: unknown) =>
    typeof personId === "string" ? (personLabel(people.get(personId)) ?? t("timeline.formerMember")) : null;

  function summary(activity: Activity): string {
    const d = activity.details as Record<string, unknown>;
    const label = (namespace: "statuses" | "stages", value: unknown) =>
      typeof value === "string" ? t(`${namespace}.${value}` as "statuses.new") : "—";
    switch (activity.type) {
      case "contact_message":
        return t("timeline.contactMessage", { topic: typeof d.topic === "string" ? t(`topics.${d.topic}` as "topics.project") : "—" });
      case "quote_request":
        return t("timeline.quoteRequest");
      case "diagnostic":
        return t("timeline.diagnostic", { score: Number(d.score ?? 0), level: String(d.level_label ?? "") });
      case "status_change":
        return t("timeline.statusChange", { from: label("statuses", d.from), to: label("statuses", d.to) });
      case "stage_change":
        return t("timeline.stageChange", {
          title: String(d.title ?? ""),
          from: label("stages", d.from),
          to: label("stages", d.to),
        });
      case "assignment":
        return d.to ? t("timeline.assigned", { name: name(d.to) ?? "" }) : t("timeline.unassigned");
      default:
        return t(`activityTypes.${activity.type}`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link href="/admin/crm/leads" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("lead.back")}
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-md font-semibold">{lead.name}</h1>
          <CrmBadge value={lead.status} label={t(`statuses.${lead.status}`)} />
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {lead.company ? <span>{lead.company}</span> : null}
          <a href={`mailto:${lead.email}`} className="text-primary-ink underline-offset-4 hover:underline">{lead.email}</a>
          {lead.phone ? <a href={`tel:${lead.phone}`} className="text-primary-ink underline-offset-4 hover:underline">{lead.phone}</a> : null}
          <span>{t("lead.since", { date: format.dateTime(new Date(lead.created_at), { dateStyle: "medium" }), source: t(`sources.${lead.source}`) })}</span>
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex flex-col gap-10">
          {lead.quote_requests.length > 0 ? (
            <section aria-labelledby="lead-quotes" className="flex flex-col gap-4">
              <h2 id="lead-quotes" className="text-heading-lg font-semibold">{t("quotes.title")}</h2>
              <ul className="flex flex-col gap-4">
                {lead.quote_requests.map((quote) => (
                  <li key={quote.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">{t("quotes.date")}</dt>
                        <dd>{date(quote.created_at)}</dd>
                        <dt className="text-muted-foreground">{t("quotes.service")}</dt>
                        <dd>
                          {quote.service
                            ? (services.find((s) => s.slug === quote.service)?.title ?? quote.service)
                            : tQuote("form.anyService")}
                        </dd>
                        <dt className="text-muted-foreground">{t("quotes.budget")}</dt>
                        <dd>{tQuote(`budgets.${quote.budget}`)}</dd>
                        <dt className="text-muted-foreground">{t("quotes.timeline")}</dt>
                        <dd>{tQuote(`timelines.${quote.timeline}`)}</dd>
                      </dl>
                      <QuoteStatusSelect quoteId={quote.id} status={quote.status} />
                    </div>
                    <p className="whitespace-pre-line">{quote.need}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="lead-timeline" className="flex flex-col gap-4">
            <h2 id="lead-timeline" className="text-heading-lg font-semibold">{t("timeline.title")}</h2>
            <ActivityForm leadId={lead.id} opportunities={lead.opportunities} />
            {lead.activities.length === 0 ? (
              <p className="text-muted-foreground">{t("timeline.empty")}</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {lead.activities.map((activity) => {
                  const Icon = ICONS[activity.type];
                  return (
                    <li key={activity.id} className="flex gap-4">
                      <span aria-hidden="true" className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                        <Icon className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="font-medium">{summary(activity)}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <CalendarDays aria-hidden="true" className="size-3.5" />
                          <time dateTime={activity.occurred_at}>{date(activity.occurred_at)}</time>
                          <span>· {personLabel(activity.author) ?? t("timeline.system")}</span>
                        </p>
                        {activity.body ? <p className="mt-1 whitespace-pre-line break-words">{activity.body}</p> : null}
                        {activity.type === "diagnostic" && typeof (activity.details as Record<string, unknown>).diagnostic_id === "string" ? (
                          <a
                            href={`/api/admin/diagnostics/${String((activity.details as Record<string, unknown>).diagnostic_id)}/report`}
                            className="text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
                          >
                            {t("timeline.diagnosticReport")}
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-8">
          <section aria-labelledby="lead-follow-up" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <h2 id="lead-follow-up" className="text-heading-sm font-semibold">{t("lead.followUp")}</h2>
            <LeadStatusSelect leadId={lead.id} status={lead.status} />
            <LeadOwnerSelect leadId={lead.id} owner={lead.owner ?? null} team={team} />
          </section>

          <section aria-labelledby="lead-opportunities" className="flex flex-col gap-4">
            <h2 id="lead-opportunities" className="text-heading-sm font-semibold">{t("opportunity.titlePlural")}</h2>
            <ul className="flex flex-col gap-4">
              {lead.opportunities.map((opportunity) => (
                <li key={opportunity.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{opportunity.title}</p>
                    <span className="text-sm tabular-nums">{money(opportunity.amount)}</span>
                  </div>
                  <StageSelect opportunityId={opportunity.id} stage={opportunity.stage} />
                  <OpportunityValueForm opportunity={opportunity} />
                </li>
              ))}
            </ul>
            <NewOpportunityForm leadId={lead.id} defaultTitle={lead.company ?? lead.name} />
          </section>

          <section aria-labelledby="lead-details" className="flex flex-col gap-4">
            <h2 id="lead-details" className="text-heading-sm font-semibold">{t("lead.details")}</h2>
            <LeadDetailsForm lead={lead} />
          </section>

          {access.crmDelete ? <DeleteLeadButton leadId={lead.id} name={lead.name} /> : null}
        </aside>
      </div>
    </div>
  );
}
