"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { creditNote, quoteAction, recordTransfer } from "@/app/[locale]/admin/billing/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { centsToInput, parseEuros } from "@/lib/billing";

import { useBillingAdminAction } from "./use-billing-admin-action";

/** Send, cancel or invoice the balance of a quote. */
export function QuoteButtons({ id, status, remaining }: { id: string; status: string; remaining: number }) {
  const t = useTranslations("Admin.billing.quotes");
  const { pending, error, run } = useBillingAdminAction();
  const act = (action: "send" | "cancel" | "balance", confirm: string) => {
    if (window.confirm(confirm)) run(() => quoteAction(id, action));
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? <Button loading={pending} onClick={() => act("send", t("sendConfirm"))}>{t("send")}</Button> : null}
        {status === "accepted" && remaining > 0 ? <Button loading={pending} onClick={() => act("balance", t("balanceConfirm"))}>{t("balance")}</Button> : null}
        {status === "draft" || status === "sent" ? (
          <Button variant="outline" disabled={pending} onClick={() => act("cancel", t("cancelConfirm"))}>{t("cancel")}</Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

/** Records a bank transfer received on an invoice (TASK-115). */
export function TransferForm({ id, due, locale }: { id: string; due: number; locale: string }) {
  const t = useTranslations("Admin.billing.invoices");
  const { pending, error, run } = useBillingAdminAction();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() =>
          recordTransfer(id, {
            amountCents: parseEuros(String(data.get("amount") ?? "")) ?? 0,
            receivedOn: String(data.get("received_on") ?? ""),
            reference: String(data.get("reference") ?? ""),
          }),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("amount")}>
          <Input name="amount" inputMode="decimal" required defaultValue={centsToInput(due, locale)} />
        </FormField>
        <FormField label={t("receivedOn")}>
          <Input name="received_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </FormField>
      </div>
      <FormField label={t("reference")}>
        <Input name="reference" maxLength={120} />
      </FormField>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("record")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}

/** Cancels an invoice with a credit note of the full amount. */
export function CreditNoteForm({ id }: { id: string }) {
  const t = useTranslations("Admin.billing.invoices");
  const router = useRouter();
  const { pending, error, run } = useBillingAdminAction();
  const [reason, setReason] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (window.confirm(t("creditConfirm"))) {
          run(() => creditNote(id, reason), ({ id: noteId }) => router.push({ pathname: "/admin/billing/invoices/[id]", params: { id: noteId } }));
        }
      }}
    >
      <p className="text-sm text-muted-foreground">{t("creditHelp")}</p>
      <FormField label={t("reason")}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={200} />
      </FormField>
      <div>
        <Button type="submit" variant="outline" loading={pending}>{t("credit")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}
