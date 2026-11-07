"use client";

import { useTranslations } from "next-intl";

import type { ExperienceError } from "@/app/[locale]/account/ai/actions";
import { useAdminAction } from "@/components/admin/use-admin-action";

/** Runs an AI experience Server Action (messages from AI.errors). */
export function useExperienceAction() {
  const t = useTranslations("AI.errors");
  return useAdminAction((code) => t(code as ExperienceError));
}
