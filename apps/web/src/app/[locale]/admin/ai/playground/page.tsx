import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { Playground } from "@/components/ai/playground";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";
import { templateVariables } from "@/lib/ai";

type Props = { params: Promise<{ locale: Locale }> };

/** Playground: try a model or a prompt, with streaming (TASK-079). */
export default function AiPlaygroundPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PlaygroundSection params={params} />
    </Suspense>
  );
}

async function PlaygroundSection({ params }: Props) {
  const { locale } = await params;
  const path = getPathname({ locale, href: "/admin/ai/playground" });
  const loaded = await adminLoad(path, (api) => api.GET("/api/v1/admin/ai/models"));
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, summaries] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.ai" }),
    adminLoad(path, (api) => api.GET("/api/v1/admin/ai/prompts")).then((r) => (r.ok ? r.data : [])),
  ]);
  // Variables of each active version, to ask for them in the form.
  const prompts = await Promise.all(
    summaries.map(async (summary) => {
      const detail = await adminLoad(path, (api) =>
        api.GET("/api/v1/admin/ai/prompts/{key}", { params: { path: { key: summary.key } } }),
      );
      const active = detail.ok ? detail.data.versions.find((v) => v.version === detail.data.active_version) : undefined;
      return { ...summary, variables: active ? templateVariables(active.template) : [] };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("playground.title")}</h1>
        <p className="text-muted-foreground">{t("playground.lead")}</p>
      </div>
      <Playground models={loaded.data} prompts={prompts} />
    </div>
  );
}
