"use client";

import { useTranslations } from "next-intl";

import { useAdminAction } from "@/components/admin/use-admin-action";
import type { BillingError } from "@/lib/billing-actions";

/** Runs a billing Server Action and refreshes the page (messages from Billing.errors). */
export function useBillingAction() {
  const t = useTranslations("Billing.errors");
  return useAdminAction((code) => t(code as BillingError));
}
