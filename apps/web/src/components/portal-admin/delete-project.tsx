"use client";

import { useTranslations } from "next-intl";

import { deleteProject } from "@/app/[locale]/admin/portal/actions";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { useRouter } from "@/i18n/navigation";

/** Deletes a project with everything in it, then goes back to the list. */
export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const t = useTranslations("Admin.portal.project");
  const router = useRouter();
  return (
    <ConfirmButton
      variant="outline"
      action={() => deleteProject(projectId)}
      confirm={t("deleteConfirm", { name })}
      onDone={() => router.push("/admin/portal")}
    >
      {t("delete")}
    </ConfirmButton>
  );
}
