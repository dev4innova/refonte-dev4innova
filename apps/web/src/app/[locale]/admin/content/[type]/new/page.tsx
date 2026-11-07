import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { DocumentEditor } from "@/components/admin/document-editor";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { accessStatus, adminApi, isDocumentType, requireSession } from "@/lib/admin";
import { redirectToLogin } from "@/lib/auth/redirect";

type Props = { params: Promise<{ locale: Locale; type: string }> };

/** Content editor (TASK-060 to TASK-066). */
export default function EditorPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Props) {
  const resolved = await params;
  const { locale, type } = resolved;
  if (!isDocumentType(type)) notFound();
  const id = "id" in resolved ? (resolved.id as string) : null;
  const returnTo = getPathname({
    locale,
    href: id
      ? { pathname: "/admin/content/[type]/[id]", params: { type, id } }
      : { pathname: "/admin/content/[type]/new", params: { type } },
  });
  const session = await requireSession(returnTo);
  const api = adminApi(session);
  const [media, document] = await Promise.all([
    api.GET("/api/v1/admin/cms/media").catch(() => null),
    id
      ? api
          .GET("/api/v1/admin/cms/documents/{document_id}", { params: { path: { document_id: id } } })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const status = media ? accessStatus(media.response.status) : "unavailable";
  if (status === "signin") redirectToLogin(returnTo);
  if (status !== "ok") return <AdminNotice locale={locale} kind={status} />;
  if (id && !document?.data) notFound();

  return <DocumentEditor type={type} initial={document?.data ?? null} media={media?.data ?? []} />;
}
