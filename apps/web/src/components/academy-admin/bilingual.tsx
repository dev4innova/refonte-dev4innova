"use client";

import { useTranslations } from "next-intl";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Texts } from "@/lib/academy";

type Props = {
  /** Field name: inputs are `${name}_fr` and `${name}_en` (read with textsFrom). */
  name: string;
  label: string;
  defaultValue?: Partial<Texts>;
  multiline?: boolean | number;
  maxLength: number;
  /** French is the reference language: required when the text is. */
  required?: boolean;
  code?: boolean;
};

/** One text in French and English, side by side from the tablet width. */
export function BilingualField({ name, label, defaultValue, multiline, maxLength, required, code }: Props) {
  const t = useTranslations("Admin.academy");
  const rows = typeof multiline === "number" ? multiline : 3;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(["fr", "en"] as const).map((locale) => (
        <FormField
          key={locale}
          label={`${label} (${t(locale)})`}
          required={required && locale === "fr"}
          requiredLabel={t("required")}
        >
          {multiline ? (
            <Textarea
              name={`${name}_${locale}`}
              defaultValue={defaultValue?.[locale] ?? ""}
              maxLength={maxLength}
              rows={rows}
              lang={locale}
              required={required && locale === "fr"}
              className={code ? "font-mono text-sm" : undefined}
            />
          ) : (
            <Input
              name={`${name}_${locale}`}
              defaultValue={defaultValue?.[locale] ?? ""}
              maxLength={maxLength}
              lang={locale}
              required={required && locale === "fr"}
            />
          )}
        </FormField>
      ))}
    </div>
  );
}
