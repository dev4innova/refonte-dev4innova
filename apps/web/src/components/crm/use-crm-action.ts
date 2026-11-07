"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { CrmResult } from "@/app/[locale]/admin/crm/actions";
import { useRouter } from "@/i18n/navigation";

/**
 * Runs a CRM Server Action in a transition, refreshes the page data on success (pages are
 * rendered per request) and exposes a translated error message on failure.
 */
export function useCrmAction() {
  const t = useTranslations("Admin.crm.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run<T>(action: () => Promise<CrmResult<T>>, onSuccess?: (data: T) => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(t(result.error));
        return;
      }
      onSuccess?.(result.data);
      router.refresh();
    });
  }

  return { pending, error, run, setError };
}
