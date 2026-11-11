import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { ModelForm } from "@/components/ai/model-form";
import { CrmBadge } from "@/components/crm/crm-badge";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adminLoad } from "@/lib/admin";

type Props = { params: Promise<{ locale: Locale }> };

/** Model registry (TASK-077): changing models or prices needs no deployment. */
export default function AiModelsPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Models params={params} />
    </Suspense>
  );
}

async function Models({ params }: Props) {
  const { locale } = await params;
  const loaded = await adminLoad(getPathname({ locale, href: "/admin/ai/models" }), (api) =>
    api.GET("/api/v1/admin/ai/models"),
  );
  if (!loaded.ok) return <AdminNotice locale={locale} kind={loaded.notice} />;
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "Admin.ai" }),
    getFormatter({ locale }),
  ]);
  const price = (value: string) => format.number(Number(value), { maximumFractionDigits: 4 });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("models.title")}</h1>
        <p className="text-muted-foreground">{t("models.lead")}</p>
      </div>

      <ul className="flex flex-col gap-4">
        {loaded.data.map((model) => (
          <li key={model.id} aria-labelledby={`model-${model.id}`} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 id={`model-${model.id}`} className="text-heading-sm font-semibold">{model.display_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {t(`providers.${model.provider}`)} · <span className="font-mono">{model.model_id}</span> ·{" "}
                  {t("models.prices", {
                    input: price(model.input_price_usd_per_mtok),
                    output: price(model.output_price_usd_per_mtok),
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {model.is_default ? <CrmBadge value="new" label={t("models.defaultBadge")} /> : null}
                <CrmBadge value={model.is_enabled ? "answered" : "declined"} label={model.is_enabled ? t("models.enabledBadge") : t("models.disabledBadge")} />
                {model.provider_configured ? null : <CrmBadge value="declined" label={t("models.notConfigured")} />}
              </div>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary-ink">{t("models.edit")}</summary>
              <div className="mt-4">
                <ModelForm model={model} />
              </div>
            </details>
          </li>
        ))}
      </ul>

      <section aria-labelledby="model-new" className="flex flex-col gap-4 rounded-xl border border-dashed border-input p-5">
        <h2 id="model-new" className="text-heading-sm font-semibold">{t("models.add")}</h2>
        <p className="text-sm text-muted-foreground">{t("models.addHelp")}</p>
        <ModelForm />
      </section>
    </div>
  );
}
