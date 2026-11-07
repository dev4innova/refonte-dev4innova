"use client";

import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs a back-office Server Action in a transition, refreshes the page data on success
 * (admin pages are rendered per request) and exposes a translated error message.
 * `describe` turns an error code into a message (a next-intl translator).
 */
export function useAdminAction(describe: (code: string) => string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run<T>(action: () => Promise<Result<T>>, onSuccess?: (data: T) => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(describe(result.error));
        return;
      }
      onSuccess?.(result.data);
      router.refresh();
    });
  }

  return { pending, error, run, setError };
}
