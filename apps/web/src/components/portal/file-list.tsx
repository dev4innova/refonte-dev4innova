import { Download, FileText } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { fileSize, type PortalFile } from "@/lib/portal";
import type { PortalResult } from "@/lib/portal-actions";

import { ConfirmButton } from "./confirm-button";

type Props = {
  files: PortalFile[];
  empty: string;
  /** Same-origin download route of a file. */
  href: (file: PortalFile) => string;
  /** Bound Server Action deleting a file, for those the user may delete. */
  remove?: (file: PortalFile) => () => Promise<PortalResult>;
};

/** Shared documents, with their download link (signed by the API on request). */
export async function FileList({ files, empty, href, remove }: Props) {
  const [t, format, locale] = await Promise.all([getTranslations("Portal"), getFormatter(), getLocale()]);
  if (files.length === 0) {
    return <p className="rounded-xl border border-dashed border-input bg-card p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  const units = { kb: t("units.kb"), mb: t("units.mb") };
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center gap-3 p-4">
          <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <div className="flex min-w-0 flex-1 flex-col">
            <a
              href={href(file)}
              className="inline-flex items-center gap-1.5 font-medium break-all underline-offset-4 hover:text-primary hover:underline"
            >
              {file.name}
              <Download aria-hidden="true" className="size-4 shrink-0" />
              <span className="sr-only"> ({t("deliverable.download")})</span>
            </a>
            <span className="text-xs text-muted-foreground">
              {file.uploaded_by_staff
                ? t("documents.byTeam")
                : t("documents.by", { name: file.uploaded_by?.display_name ?? file.uploaded_by?.email ?? t("deletedUser") })}{" "}
              {t("documents.addedOn", { date: format.dateTime(new Date(file.created_at), { dateStyle: "medium" }) })} ·{" "}
              {fileSize(file.size_bytes, units, locale)}
            </span>
          </div>
          {remove && file.can_delete ? (
            <ConfirmButton
              action={remove(file)}
              label={t("documents.deleteName", { name: file.name })}
              confirm={t("documents.deleteConfirm", { name: file.name })}
            >
              {t("documents.delete")}
            </ConfirmButton>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
