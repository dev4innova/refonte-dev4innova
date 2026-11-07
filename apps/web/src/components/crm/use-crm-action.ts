"use client";

import { useTranslations } from "next-intl";

import type { CrmError } from "@/app/[locale]/admin/crm/actions";
import { useAdminAction } from "@/components/admin/use-admin-action";

/** CRM flavour of useAdminAction (messages from Admin.crm.errors). */
export function useCrmAction() {
  const t = useTranslations("Admin.crm.errors");
  return useAdminAction((code) => t(code as CrmError));
}
