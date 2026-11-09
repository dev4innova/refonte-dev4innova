"use client";

import { useTranslations } from "next-intl";

import type { AcademyAdminError } from "@/app/[locale]/admin/academy/actions";
import { useAdminAction } from "@/components/admin/use-admin-action";

/** Runs an Academy back-office Server Action, then refreshes the page (Admin.academy.errors). */
export function useAcademyAction() {
  const t = useTranslations("Admin.academy.errors");
  return useAdminAction((code) => t(code as AcademyAdminError));
}
