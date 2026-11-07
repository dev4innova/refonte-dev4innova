"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { createOpportunity, updateOpportunity } from "@/app/[locale]/admin/crm/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Opportunity } from "@/lib/crm";

import { useCrmAction } from "./use-crm-action";

/** Opens an opportunity for a prospect (TASK-069). */
export function NewOpportunityForm({ leadId, defaultTitle }: { leadId: string; defaultTitle: string }) {
  const t = useTranslations("Admin.crm");
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, error, run } = useCrmAction();
  return (
    <form
      ref={formRef}
      aria-labelledby="opportunity-form-title"
      className="flex flex-col gap-4 rounded-xl border border-dashed border-input p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(
          () =>
            createOpportunity({
              leadId,
              title: String(data.get("title") ?? ""),
              amount: String(data.get("amount") ?? ""),
              expectedCloseOn: String(data.get("expectedCloseOn") ?? ""),
            }),
          () => formRef.current?.reset(),
        );
      }}
    >
      <h3 id="opportunity-form-title" className="text-sm font-semibold">{t("opportunity.new")}</h3>
      <FormField label={t("opportunity.title")} required requiredLabel={t("required")}>
        <Input name="title" defaultValue={defaultTitle} required minLength={2} maxLength={200} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("opportunity.amount")} description={t("opportunity.amountHelp")}>
          <Input name="amount" inputMode="decimal" maxLength={20} />
        </FormField>
        <FormField label={t("opportunity.expectedCloseOn")}>
          <Input name="expectedCloseOn" type="date" />
        </FormField>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("opportunity.create")}</Button>
      </div>
    </form>
  );
}

/** Amount and expected closing date of an existing opportunity. */
export function OpportunityValueForm({ opportunity }: { opportunity: Opportunity }) {
  const t = useTranslations("Admin.crm");
  const { pending, error, run } = useCrmAction();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() =>
          updateOpportunity(opportunity.id, {
            amount: String(data.get("amount") ?? ""),
            expectedCloseOn: String(data.get("expectedCloseOn") ?? ""),
          }),
        );
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t("opportunity.amount")}
        <Input name="amount" inputMode="decimal" maxLength={20} defaultValue={opportunity.amount ?? ""} className="h-9 w-32 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t("opportunity.expectedCloseOn")}
        <Input name="expectedCloseOn" type="date" defaultValue={opportunity.expected_close_on ?? ""} className="h-9 w-40 text-sm" />
      </label>
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        {t("save")}
        <span className="sr-only"> : {opportunity.title}</span>
      </Button>
      {error ? <p role="alert" className="w-full text-xs font-medium text-destructive">{error}</p> : null}
    </form>
  );
}
