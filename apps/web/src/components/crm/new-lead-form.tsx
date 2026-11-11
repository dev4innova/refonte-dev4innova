"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { createLead } from "@/app/[locale]/admin/crm/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Link, useRouter } from "@/i18n/navigation";

import { useCrmAction } from "./use-crm-action";

/** Disclosure with the form to enter a prospect by hand (TASK-067). */
export function NewLeadForm({ locale }: { locale: "fr" | "en" }) {
  const t = useTranslations("Admin.crm");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { pending, error, run } = useCrmAction();
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  return (
    <>
      <Button onClick={() => dialogRef.current?.showModal()}>
        <Plus aria-hidden="true" />
        {t("leads.new")}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="new-lead-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-6 text-foreground shadow-elevated backdrop:bg-black/50"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const text = (key: string) => String(data.get(key) ?? "");
            setDuplicateId(null);
            run(
              async () => {
                const result = await createLead({
                  email: text("email"),
                  name: text("name"),
                  company: text("company"),
                  phone: text("phone"),
                  locale: text("locale") === "en" ? "en" : "fr",
                });
                if (!result.ok && result.leadId) setDuplicateId(result.leadId);
                return result;
              },
              ({ id }) => router.push({ pathname: "/admin/crm/leads/[id]", params: { id } }),
            );
          }}
        >
          <h2 id="new-lead-title" className="text-heading-lg font-semibold">{t("leads.new")}</h2>
          <FormField label={t("lead.name")} required requiredLabel={t("required")}>
            <Input name="name" required minLength={2} maxLength={120} autoComplete="off" />
          </FormField>
          <FormField label={t("lead.email")} required requiredLabel={t("required")}>
            <Input name="email" type="email" required maxLength={320} autoComplete="off" />
          </FormField>
          <FormField label={t("lead.company")}>
            <Input name="company" maxLength={160} autoComplete="off" />
          </FormField>
          <FormField label={t("lead.phone")}>
            <Input name="phone" type="tel" maxLength={40} autoComplete="off" />
          </FormField>
          <FormField label={t("lead.locale")}>
            <NativeSelect name="locale" defaultValue={locale}>
              <option value="fr">{t("locales.fr")}</option>
              <option value="en">{t("locales.en")}</option>
            </NativeSelect>
          </FormField>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}{" "}
              {duplicateId ? (
                <Link
                  href={{ pathname: "/admin/crm/leads/[id]", params: { id: duplicateId } }}
                  className="text-primary-ink underline underline-offset-4"
                >
                  {t("leads.openExisting")}
                </Link>
              ) : null}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={pending}>{t("leads.create")}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
