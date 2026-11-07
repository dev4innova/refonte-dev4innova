import { Lock, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/marketing/empty-state";
import type { Locale } from "@/i18n/routing";

/** Shown when the API refuses access (not staff) or is unreachable. */
export async function AdminNotice({ locale, kind }: { locale: Locale; kind: "forbidden" | "unavailable" }) {
  const t = await getTranslations({ locale, namespace: "Admin" });
  return kind === "forbidden" ? (
    <EmptyState icon={Lock} title={t("forbiddenTitle")} text={t("forbiddenText")} />
  ) : (
    <EmptyState icon={TriangleAlert} title={t("unavailable")} text="" />
  );
}
