"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { setQuota } from "@/app/[locale]/admin/ai/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useAiAction } from "./use-ai-action";

/** Monthly AI budget of one organization (TASK-081). Empty: the default budget. */
export function QuotaForm({
  organizationId,
  organizationName,
  budget,
  specific,
}: {
  organizationId: string;
  organizationName: string;
  budget: string;
  specific: boolean;
}) {
  const t = useTranslations("Admin.ai");
  const id = useId();
  const { pending, error, run } = useAiAction();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get("budget") ?? "");
        run(() => setQuota(organizationId, value));
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t("usage.budgetFor", { name: organizationName })}
      </label>
      <Input
        id={id}
        name="budget"
        inputMode="decimal"
        defaultValue={specific ? budget : ""}
        placeholder={t("usage.defaultBudget")}
        className="h-9 w-28 text-sm"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        {t("save")}
        <span className="sr-only"> : {organizationName}</span>
      </Button>
      {error ? (
        <p id={`${id}-error`} role="alert" className="w-full text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
