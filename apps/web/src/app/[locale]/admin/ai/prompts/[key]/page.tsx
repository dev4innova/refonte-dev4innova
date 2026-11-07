import { ArrowLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { ActivateVersionButton, PromptVersionForm } from "@/components/ai/prompt-version-form";
import { CrmBadge } from "@/components/crm/crm-badge";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale; key: string }> };

/** One prompt: immutable versions, the active one, and a form for the next (TASK-078). */
export default function AiPromptPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PromptDetail params={params} />
    </Suspense>
  );
}

async function PromptDetail({ params }: Props) {
  const { locale, key } = await params;
  const path = getPathname({ locale, href: { pathname: "/admin/ai/prompts/[key]", params: { key } } });
  const loaded = await adminLoad(path, (api) =>
    api.GET("/api/v1/admin/ai/prompts/{key}", { params: { path: { key } } }),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const prompt = loaded.data;
  const [t, format, models] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.ai" }),
    getFormatter({ locale }),
    adminLoad(path, (api) => api.GET("/api/v1/admin/ai/models")).then((r) => (r.ok ? r.data : [])),
  ]);
  const active = prompt.versions.find((v) => v.version === prompt.active_version) ?? prompt.versions[0];
  const modelName = (id: string | null | undefined) =>
    id ? (models.find((m) => m.id === id)?.display_name ?? t("prompts.unknownModel")) : t("prompts.defaultModel");

  return (
    <div className="flex flex-col gap-8">
      <Link href="/admin/ai/prompts" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("prompts.back")}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-mono text-display-md font-semibold break-all">{prompt.key}</h1>
        {prompt.description ? <p className="text-muted-foreground">{prompt.description}</p> : null}
      </div>

      <section aria-labelledby="prompt-new-version" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 id="prompt-new-version" className="text-heading-lg font-semibold">{t("prompts.newVersion")}</h2>
        <p className="text-sm text-muted-foreground">{t("prompts.newVersionHelp")}</p>
        <PromptVersionForm key={active?.id} promptKey={prompt.key} base={active} models={models.filter((m) => m.is_enabled)} />
      </section>

      <section aria-labelledby="prompt-versions" className="flex flex-col gap-4">
        <h2 id="prompt-versions" className="text-heading-lg font-semibold">{t("prompts.versions")}</h2>
        <ol className="flex flex-col gap-4">
          {prompt.versions.map((version) => {
            const isActive = version.version === prompt.active_version;
            return (
              <li key={version.id} aria-labelledby={`version-${version.version}`} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 id={`version-${version.version}`} className="flex items-center gap-2 font-semibold">
                      {t("prompts.version", { version: version.version })}
                      {isActive ? <CrmBadge value="answered" label={t("prompts.active")} /> : null}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(version.created_at), { dateStyle: "medium", timeStyle: "short" })} · {modelName(version.model_id)}
                      {version.max_tokens ? ` · ${t("prompts.maxTokensValue", { count: version.max_tokens })}` : ""}
                      {version.notes ? ` · ${version.notes}` : ""}
                    </p>
                  </div>
                  {isActive ? null : <ActivateVersionButton promptKey={prompt.key} version={version.version} />}
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-primary">{t("prompts.show")}</summary>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("prompts.system")}</p>
                      <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{version.system}</pre>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("prompts.template")}</p>
                      <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{version.template || "—"}</pre>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
