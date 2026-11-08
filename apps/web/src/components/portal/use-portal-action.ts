"use client";

import { useTranslations } from "next-intl";

import { useAdminAction } from "@/components/admin/use-admin-action";
import type { PortalError } from "@/lib/portal-actions";

/** Runs a portal Server Action and refreshes the page (messages from Portal.errors). */
export function usePortalAction() {
  const t = useTranslations("Portal.errors");
  return useAdminAction((code) => t(code as PortalError));
}
