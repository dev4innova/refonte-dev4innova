"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { addActivity } from "@/app/[locale]/admin/crm/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { isOneOf, MANUAL_ACTIVITY_TYPES, type Opportunity } from "@/lib/crm";

import { useCrmAction } from "./use-crm-action";

/** Logs a note, call, email or meeting on a prospect (TASK-068). */
export function ActivityForm({ leadId, opportunities }: { leadId: string; opportunities: Opportunity[] }) {
  const t = useTranslations("Admin.crm");
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, error, run } = useCrmAction();

  return (
    <form
      ref={formRef}
      aria-labelledby="activity-form-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const type = String(data.get("type"));
        const opportunityId = String(data.get("opportunity") ?? "");
        run(
          () =>
            addActivity(leadId, {
              type: isOneOf(MANUAL_ACTIVITY_TYPES, type) ? type : "note",
              body: String(data.get("body") ?? ""),
              occurredAt: String(data.get("occurredAt") ?? ""),
              opportunityId: opportunityId || null,
            }),
          () => formRef.current?.reset(),
        );
      }}
    >
      <h2 id="activity-form-title" className="text-heading-sm font-semibold">{t("activity.new")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("activity.type")}>
          <NativeSelect name="type" defaultValue="note">
            {MANUAL_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>{t(`activityTypes.${type}`)}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t("activity.occurredAt")} description={t("activity.occurredAtHelp")}>
          <Input name="occurredAt" type="datetime-local" />
        </FormField>
      </div>
      {opportunities.length > 0 ? (
        <FormField label={t("activity.opportunity")}>
          <NativeSelect name="opportunity" defaultValue="">
            <option value="">{t("activity.noOpportunity")}</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </NativeSelect>
        </FormField>
      ) : null}
      <FormField label={t("activity.body")} required requiredLabel={t("required")}>
        <Textarea name="body" rows={4} required maxLength={5000} />
      </FormField>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" loading={pending}>{t("activity.add")}</Button>
      </div>
    </form>
  );
}
