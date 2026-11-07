"use client";

import { useTranslations } from "next-intl";

import type { AIError } from "@/app/[locale]/admin/ai/actions";
import { useAdminAction } from "@/components/admin/use-admin-action";

/** AI flavour of useAdminAction (messages from Admin.ai.errors). */
export function useAiAction() {
  const t = useTranslations("Admin.ai.errors");
  return useAdminAction((code) => t(code as AIError));
}
