"use client";

import { useTranslations } from "next-intl";

import { useAdminAction } from "@/components/admin/use-admin-action";

/** Runs a back-office billing Server Action (messages from Admin.billing.errors). */
export function useBillingAdminAction() {
  const t = useTranslations("Admin.billing.errors");
  return useAdminAction((code) =>
    t((["signin", "forbidden", "notFound", "code", "conflict", "validation"].includes(code) ? code : "generic") as "generic"),
  );
}
