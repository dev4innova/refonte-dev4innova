import { ArrowLeft, FileSearch, MessageSquare, PenLine } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { HubActions } from "@/components/ai-experiences/hub-actions";
import { DeleteAllSessions } from "@/components/ai-experiences/session-controls";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { getMembership } from "@/lib/ai-experiences-server";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: Locale; org: string }> };

const ICONS = { assistant: MessageSquare, document: FileSearch, content: PenLine } as const;

/** AI tools of an organization: start an experience, find past sessions (EPIC 09). */
export default function AiHubPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Hub params={params} />
    </Suspense>
  );
}

async function Hub({ params }: Props) {
  const { locale, org } = await params;
  const returnTo = getPathname({ locale, href: { pathname: "/account/ai/[org]", params: { org } } });
  const { session, membership } = await getMembership(returnTo, org);
  if (!membership) notFound();
  const api = serverApi(session.accessToken);
  const canSeeUsage = membership.role === "owner" || membership.role === "admin" || membership.role === "staff_admin";
  const [t, format, sessions, usage] = await Promise.all([
    getTranslations({ locale, namespace: "AI" }),
    getFormatter({ locale }),
    api
      .GET("/api/v1/organizations/{organization_id}/ai/sessions", { params: { path: { organization_id: org } } })
      .then((r) => r.data)
      .catch(() => undefined),
    canSeeUsage
      ? api
          .GET("/api/v1/organizations/{organization_id}/ai/usage", { params: { path: { organization_id: org } } })
          .then((r) => r.data)
          .catch(() => undefined)
      : undefined,
  ]);
  const euros = (value: string) => format.number(Number(value), { style: "currency", currency: "EUR" });

  return (
    <>
      <Link href="/account" className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-2">
        <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary-ink uppercase">{membership.organization_name}</p>
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("lead")}</p>
      </div>

      <HubActions org={org} locale={locale} />

      {usage ? (
        <section aria-labelledby="ai-usage" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <h2 id="ai-usage" className="text-heading-sm font-semibold">{t("usage.title")}</h2>
          <p>
            {t("usage.spent", { spent: euros(usage.spent_eur), budget: euros(usage.monthly_budget_eur), calls: usage.calls })}
          </p>
          <span aria-hidden="true" className="block h-2 max-w-md rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", Number(usage.spent_eur) >= 0.9 * Number(usage.monthly_budget_eur) ? "bg-destructive" : "bg-primary")}
              style={{ width: `${Math.min(100, Number(usage.monthly_budget_eur) > 0 ? Math.round((Number(usage.spent_eur) / Number(usage.monthly_budget_eur)) * 100) : 100)}%` }}
            />
          </span>
          {usage.features.length ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {usage.features.map((f) => (
                <li key={f.feature}>
                  {t.has(`kinds.${f.feature}` as "kinds.assistant") ? t(`kinds.${f.feature}` as "kinds.assistant") : f.feature} : {t("usage.calls", { count: f.calls })}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("usage.help")}</p>
        </section>
      ) : null}

      <section aria-labelledby="ai-history" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ai-history" className="text-heading-lg font-semibold">{t("history.title")}</h2>
          {sessions && sessions.total > 0 ? <DeleteAllSessions org={org} /> : null}
        </div>
        <p className="text-sm text-muted-foreground">{t("history.retention")}</p>
        {!sessions ? (
          <p role="alert" className="text-destructive">{t("errors.generic")}</p>
        ) : sessions.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-input bg-card p-8 text-center text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {sessions.items.map((s) => {
              const Icon = ICONS[s.kind];
              return (
                <li key={s.id} className="flex items-center gap-3 p-4">
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-primary-ink" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={{ pathname: "/account/ai/[org]/[session]", params: { org, session: s.id } }}
                      className="truncate font-medium underline-offset-4 hover:text-primary-ink hover:underline"
                    >
                      {s.title || t("history.untitled")}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {t(`kinds.${s.kind}`)} · {format.dateTime(new Date(s.last_activity_at), { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
