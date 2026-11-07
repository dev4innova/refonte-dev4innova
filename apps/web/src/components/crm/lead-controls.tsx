"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  assignLead,
  deleteLead,
  updateLead,
  updateOpportunity,
  updateQuoteStatus,
} from "@/app/[locale]/admin/crm/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useRouter } from "@/i18n/navigation";
import {
  LEAD_STATUSES,
  type LeadDetail,
  type LeadStatus,
  type Person,
  personLabel,
  QUOTE_STATUSES,
  type QuoteStatus,
  type Stage,
  STAGES,
} from "@/lib/crm";

import { ActionSelect } from "./action-select";
import { useCrmAction } from "./use-crm-action";

/** Status of a prospect (TASK-067). */
export function LeadStatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const t = useTranslations("Admin.crm");
  return (
    <ActionSelect
      key={status}
      label={t("lead.status")}
      value={status}
      size="md"
      options={LEAD_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
      onChange={(value) => updateLead(leadId, { status: value as LeadStatus })}
    />
  );
}

/** Sales person in charge of a prospect (TASK-070). */
export function LeadOwnerSelect({ leadId, owner, team }: { leadId: string; owner: Person | null; team: Person[] }) {
  const t = useTranslations("Admin.crm");
  const options = [
    { value: "", label: t("unassigned") },
    ...team.map((person) => ({ value: person.id, label: personLabel(person) ?? person.id })),
  ];
  // The owner may have left the team: keep them visible.
  if (owner && !team.some((p) => p.id === owner.id)) {
    options.push({ value: owner.id, label: personLabel(owner) ?? owner.id });
  }
  return (
    <ActionSelect
      key={owner?.id ?? "none"}
      label={t("lead.owner")}
      value={owner?.id ?? ""}
      size="md"
      options={options}
      onChange={(value) => assignLead(leadId, value || null)}
    />
  );
}

/** Contact details of a prospect. */
export function LeadDetailsForm({ lead }: { lead: LeadDetail }) {
  const t = useTranslations("Admin.crm");
  const { pending, error, run } = useCrmAction();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        run(() =>
          updateLead(lead.id, {
            name: text("name"),
            company: text("company"),
            phone: text("phone"),
            locale: text("locale") === "en" ? "en" : "fr",
          }),
        );
      }}
    >
      <FormField label={t("lead.name")} required requiredLabel={t("required")}>
        <Input name="name" defaultValue={lead.name} required minLength={2} maxLength={120} />
      </FormField>
      <FormField label={t("lead.company")}>
        <Input name="company" defaultValue={lead.company ?? ""} maxLength={160} />
      </FormField>
      <FormField label={t("lead.phone")}>
        <Input name="phone" type="tel" defaultValue={lead.phone ?? ""} maxLength={40} />
      </FormField>
      <FormField label={t("lead.locale")}>
        <NativeSelect name="locale" defaultValue={lead.locale}>
          <option value="fr">{t("locales.fr")}</option>
          <option value="en">{t("locales.en")}</option>
        </NativeSelect>
      </FormField>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("save")}</Button>
      </div>
    </form>
  );
}

/** GDPR erasure of a prospect (staff admins only). */
export function DeleteLeadButton({ leadId, name }: { leadId: string; name: string }) {
  const t = useTranslations("Admin.crm");
  const router = useRouter();
  const { pending, error, run } = useCrmAction();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        className="justify-start text-destructive"
        loading={pending}
        onClick={() => {
          if (!window.confirm(t("lead.deleteConfirm", { name }))) return;
          run(() => deleteLead(leadId), () => router.replace("/admin/crm/leads"));
        }}
      >
        <Trash2 aria-hidden="true" />
        {t("lead.delete")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("lead.deleteHelp")}</p>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

/** Stage of an opportunity (TASK-069). */
export function StageSelect({ opportunityId, stage, hideLabel }: { opportunityId: string; stage: Stage; hideLabel?: boolean }) {
  const t = useTranslations("Admin.crm");
  return (
    <ActionSelect
      key={stage}
      label={t("opportunity.stage")}
      hideLabel={hideLabel}
      value={stage}
      options={STAGES.map((s) => ({ value: s, label: t(`stages.${s}`) }))}
      onChange={(value) => updateOpportunity(opportunityId, { stage: value as Stage })}
    />
  );
}

/** Follow-up status of a quote request (TASK-072). */
export function QuoteStatusSelect({ quoteId, status }: { quoteId: string; status: QuoteStatus }) {
  const t = useTranslations("Admin.crm");
  return (
    <ActionSelect
      key={status}
      label={t("quotes.status")}
      value={status}
      options={QUOTE_STATUSES.map((s) => ({ value: s, label: t(`quoteStatuses.${s}`) }))}
      onChange={(value) => updateQuoteStatus(quoteId, value as QuoteStatus)}
    />
  );
}
