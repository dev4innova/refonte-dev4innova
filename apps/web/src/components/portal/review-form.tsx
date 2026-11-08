"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { reviewDeliverable } from "@/app/[locale]/account/portal/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

import { usePortalAction } from "./use-portal-action";

/** The client approves a deliverable or requests changes, with a comment (TASK-099). */
export function ReviewForm({ org, deliverableId }: { org: string; deliverableId: string }) {
  const t = useTranslations("Portal.deliverable");
  const { pending, error, run } = usePortalAction();
  const [comment, setComment] = useState("");
  const [missing, setMissing] = useState(false);

  function decide(decision: "approved" | "changes_requested") {
    if (decision === "changes_requested" && !comment.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    run(() => reviewDeliverable(org, deliverableId, decision, comment));
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{t("reviewTitle")}</legend>
      <FormField label={t("comment")} description={missing ? undefined : t("commentHelp")} error={missing ? t("commentHelp") : undefined}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} rows={3} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="button" loading={pending} onClick={() => decide("approved")}>{t("approve")}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => decide("changes_requested")}>
          {t("requestChanges")}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </fieldset>
  );
}
