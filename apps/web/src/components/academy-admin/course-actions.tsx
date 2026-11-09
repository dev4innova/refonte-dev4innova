"use client";

import { useTranslations } from "next-intl";

import { deleteCourse, setPublished } from "@/app/[locale]/admin/academy/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

import { useAcademyAction } from "./use-academy-action";

/** Publish, unpublish or delete a course. */
export function CourseActions({ id, name, published, canPublish }: { id: string; name: string; published: boolean; canPublish: boolean }) {
  const t = useTranslations("Admin.academy.course");
  const router = useRouter();
  const publish = useAcademyAction();
  const remove = useAcademyAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {published ? (
          <Button
            variant="outline"
            loading={publish.pending}
            onClick={() => {
              if (window.confirm(t("unpublishConfirm"))) publish.run(() => setPublished(id, false));
            }}
          >
            {t("unpublish")}
          </Button>
        ) : (
          <Button loading={publish.pending} disabled={!canPublish} onClick={() => publish.run(() => setPublished(id, true))}>
            {t("publish")}
          </Button>
        )}
        <Button
          variant="ghost"
          loading={remove.pending}
          onClick={() => {
            if (window.confirm(t("deleteConfirm", { name }))) remove.run(() => deleteCourse(id), () => router.push("/admin/academy"));
          }}
        >
          {t("delete")}
        </Button>
      </div>
      {publish.error || remove.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">{publish.error ?? remove.error}</p>
      ) : null}
    </div>
  );
}
