import { ArrowLeft, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Chat } from "@/components/ai-experiences/chat";
import { SessionControls } from "@/components/ai-experiences/session-controls";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { getMembership } from "@/lib/ai-experiences-server";

type Props = { params: Promise<{ locale: Locale; org: string; session: string }> };

/** One AI session: history and conversation (TASK-083 to TASK-087). */
export default function AiSessionPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <SessionView params={params} />
    </Suspense>
  );
}

async function SessionView({ params }: Props) {
  const { locale, org, session: sessionId } = await params;
  const returnTo = getPathname({ locale, href: { pathname: "/account/ai/[org]/[session]", params: { org, session: sessionId } } });
  const { session, membership } = await getMembership(returnTo, org);
  if (!membership) notFound();
  const result = await serverApi(session.accessToken)
    .GET("/api/v1/organizations/{organization_id}/ai/sessions/{session_id}", {
      params: { path: { organization_id: org, session_id: sessionId } },
    })
    .catch(() => null);
  if (!result?.data) notFound();
  const detail = result.data;
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "AI" }), getFormatter({ locale })]);

  return (
    <>
      <Link href={{ pathname: "/account/ai/[org]", params: { org } }} className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("session.back", { organization: membership.organization_name })}
      </Link>
      <header className="flex flex-col gap-3">
        <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary-ink uppercase">{t(`kinds.${detail.kind}`)}</p>
        <h1 className="text-display-md font-semibold break-words">{detail.title || t("history.untitled")}</h1>
        {detail.kind === "document" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText aria-hidden="true" className="size-4" />
            {t("session.document", { name: detail.document_name ?? "", chars: format.number(detail.document_chars ?? 0) })}
          </p>
        ) : null}
        {detail.kind === "content" ? (
          <p className="text-sm text-muted-foreground">
            {t(`formats.${detail.options.format}` as "formats.email")} · {t(`tones.${detail.options.tone}` as "tones.professional")} ·{" "}
            {t(`lengths.${detail.options.length}` as "lengths.short")} · {t(`languages.${detail.options.language}` as "languages.fr")}
          </p>
        ) : null}
        <SessionControls org={org} id={detail.id} title={detail.title} />
      </header>
      <Chat
        org={org}
        sessionId={detail.id}
        kind={detail.kind}
        initialMessages={detail.messages.map(({ id, role, text, status }) => ({ id, role, text, status }))}
      />
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </>
  );
}
