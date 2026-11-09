import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { deleteDocument, uploadDocument } from "@/app/[locale]/account/portal/actions";
import { FileList } from "@/components/portal/file-list";
import { PortalHeader } from "@/components/portal/portal-header";
import { UploadForm } from "@/components/portal/upload-form";
import type { Locale } from "@/i18n/routing";
import { portalContext } from "@/lib/portal-server";

type Props = { params: Promise<{ locale: Locale; org: string }> };

/** Documents shared between the organization and DEV4INNOVA (TASK-100). */
export default function PortalDocumentsPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <PortalDocuments params={params} />
    </Suspense>
  );
}

async function PortalDocuments({ params }: Props) {
  const { locale, org } = await params;
  const { membership, api } = await portalContext(locale, { pathname: "/account/portal/[org]/documents", params: { org } }, org);
  const path = { params: { path: { organization_id: org } } };
  const [t, documents, projects] = await Promise.all([
    getTranslations({ locale, namespace: "Portal" }),
    api.GET("/api/v1/organizations/{organization_id}/portal/documents", path).then((r) => r.data).catch(() => undefined),
    api.GET("/api/v1/organizations/{organization_id}/portal/projects", path).then((r) => r.data).catch(() => undefined),
  ]);

  return (
    <>
      <PortalHeader org={org} organizationName={membership.organization_name} role={membership.role} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md font-semibold">{t("documents.title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("documents.lead")}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="documents-list" className="flex min-w-0 flex-col gap-4">
          <h2 id="documents-list" className="sr-only">{t("documents.title")}</h2>
          {!documents ? (
            <p role="alert" className="text-destructive">{t("errors.load")}</p>
          ) : (
            <FileList
              files={documents}
              empty={t("documents.empty")}
              href={(file) => `/api/portal/${org}/files/${file.id}`}
              remove={(file) => deleteDocument.bind(null, org, file.id)}
            />
          )}
        </section>
        <section aria-labelledby="documents-upload" className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-5">
          <h2 id="documents-upload" className="text-heading-sm font-semibold">{t("documents.upload")}</h2>
          <UploadForm
            action={uploadDocument.bind(null, org)}
            projects={(projects?.items ?? []).map((p) => ({ id: p.id, name: p.name }))}
            submitLabel={t("documents.submit")}
          />
        </section>
      </div>
    </>
  );
}
