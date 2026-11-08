"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { type DiagnosticError, unlockDiagnostic } from "@/app/[locale]/diagnostic/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";

/** Leave an email to get the full report (TASK-093, TASK-095). */
export function UnlockForm({ token }: { token: string }) {
  const t = useTranslations("Diagnostic");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<DiagnosticError | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const fieldError = (name: string) => (fields.includes(name) ? t(`unlock.errors.${name as "name"}`) : undefined);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await unlockDiagnostic(token, data);
          if (!result.ok) {
            setError(result.error);
            setFields(result.fields ?? []);
            return;
          }
          router.refresh();
        });
      }}
    >
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive bg-accent p-3 text-sm font-medium text-accent-foreground">
          {error === "validation" ? t("unlock.errors.summary") : t(`errors.${error}`)}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("unlock.name")} required requiredLabel={t("requiredLabel")} error={fieldError("name")}>
          <Input name="name" autoComplete="name" required minLength={2} maxLength={120} />
        </FormField>
        <FormField label={t("unlock.email")} required requiredLabel={t("requiredLabel")} error={fieldError("email")}>
          <Input name="email" type="email" autoComplete="email" required maxLength={320} />
        </FormField>
      </div>
      <FormField label={t("unlock.company")} description={t("optional")} error={fieldError("company")}>
        <Input name="company" autoComplete="organization" maxLength={160} />
      </FormField>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          {t("honeypot")}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <FormField label={t("unlock.consent")} inline required requiredLabel={t("requiredLabel")} error={fieldError("consent")}>
          <Checkbox name="consent" value="on" />
        </FormField>
        <Link href="/privacy" className="ml-8 text-sm text-primary underline underline-offset-4">{t("unlock.privacy")}</Link>
      </div>
      <div>
        <Button type="submit" loading={pending}>{t("unlock.submit")}</Button>
      </div>
    </form>
  );
}
