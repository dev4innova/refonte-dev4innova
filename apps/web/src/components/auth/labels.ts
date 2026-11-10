import "server-only";

import { getTranslations } from "next-intl/server";

import type { AuthFieldConfig, AuthFormLabels } from "@/components/auth/auth-form";
import type { Locale } from "@/i18n/routing";

type Form = "signIn" | "signUp" | "security" | "reset";

/** Labels and fields of one account form, in the page's language. */
export async function authForm(locale: Locale, form: Form): Promise<{ labels: AuthFormLabels; fields: AuthFieldConfig[] }> {
  const t = await getTranslations({ locale, namespace: "Auth" });
  const labels: AuthFormLabels = {
    submit: t(`${form}.submit`),
    sending: t(`${form}.sending`),
    required: t("required"),
    summary: t("summary"),
    fieldErrors: {
      required: t("fieldErrors.required"),
      invalidEmail: t("fieldErrors.invalidEmail"),
      tooShort: t("fieldErrors.tooShort"),
      tooLong: t("fieldErrors.tooLong"),
      mismatch: t("fieldErrors.mismatch"),
      sameAsEmail: t("fieldErrors.sameAsEmail"),
      taken: t("fieldErrors.taken"),
      wrong: t("fieldErrors.wrong"),
      unknownAccount: t("fieldErrors.unknownAccount"),
    },
    formErrors: {
      invalidCredentials: t("formErrors.invalidCredentials"),
      rateLimited: t("formErrors.rateLimited"),
      unavailable: t("formErrors.unavailable"),
      forbidden: t("formErrors.forbidden"),
    },
  };
  const email: AuthFieldConfig = { name: "email", label: t("fields.email"), type: "email", autoComplete: "email" };
  const newPassword = (label: string): AuthFieldConfig[] => [
    { name: "password", label, type: "password", autoComplete: "new-password", description: t("fields.passwordHelp") },
    { name: "confirm", label: t("fields.confirm"), type: "password", autoComplete: "new-password" },
  ];
  switch (form) {
    case "signIn":
      return { labels, fields: [email, { name: "password", label: t("fields.password"), type: "password", autoComplete: "current-password" }] };
    case "signUp":
      return {
        labels,
        fields: [{ name: "name", label: t("fields.name"), type: "text", autoComplete: "name" }, email, ...newPassword(t("fields.password"))],
      };
    case "security":
      return {
        labels: { ...labels, success: { title: t("security.successTitle"), text: t("security.successText") } },
        fields: [{ name: "current", label: t("fields.current"), type: "password", autoComplete: "current-password" }, ...newPassword(t("fields.newPassword"))],
      };
    case "reset":
      return {
        labels: { ...labels, temporaryPassword: { title: t("reset.resultTitle"), text: t("reset.resultText") } },
        fields: [{ ...email, label: t("fields.accountEmail"), autoComplete: "off" }],
      };
  }
}
