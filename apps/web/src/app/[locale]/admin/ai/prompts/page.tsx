import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { PromptVersionForm } from "@/components/ai/prompt-version-form";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }> };

/** Versioned prompts (TASK-078). */
export default function AiPromptsPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Prompts params={params} />
    </Suspense>
  );
}

async function Prompts({ params }: Props) {
  const { locale } = await params;
  const path = getPathname({ locale, href: "/admin/ai/prompts" });
  const loaded = await adminLoad(path, (api) => api.GET("/api/v1/admin/ai/prompts"));
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, format, models] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.ai" }),
    getFormatter({ locale }),
    adminLoad(path, (api) => api.GET("/api/v1/admin/ai/models")).then((r) => (r.ok ? r.data : [])),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("prompts.title")}</h1>
        <p className="text-muted-foreground">{t("prompts.lead")}</p>
      </div>
      {loaded.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">{t("prompts.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {loaded.data.map((prompt) => (
            <li key={prompt.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-col gap-1">
                <Link
                  href={{ pathname: "/admin/ai/prompts/[key]", params: { key: prompt.key } }}
                  className="font-mono font-medium underline-offset-4 hover:text-primary hover:underline"
                >
                  {prompt.key}
                </Link>
                {prompt.description ? <p className="text-sm text-muted-foreground">{prompt.description}</p> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {prompt.active_version ? t("prompts.activeVersion", { version: prompt.active_version }) : t("prompts.noActive")} ·{" "}
                {t("prompts.versionCount", { count: prompt.versions })} ·{" "}
                {format.dateTime(new Date(prompt.updated_at), { dateStyle: "medium" })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="prompt-new" className="flex flex-col gap-4 rounded-xl border border-dashed border-input p-5">
        <h2 id="prompt-new" className="text-heading-sm font-semibold">{t("prompts.new")}</h2>
        <PromptVersionForm models={models.filter((m) => m.is_enabled)} />
      </section>
    </div>
  );
}
