"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { enrollInCourse } from "@/app/[locale]/account/academy/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

/** Self-enrollment in an open course, then the course outline of the learner (TASK-106). */
export function EnrollButton({ slug, locale }: { slug: string; locale: "fr" | "en" }) {
  const t = useTranslations("Academy");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await enrollInCourse(slug, locale);
            if (!result.ok) {
              setError(t(`errors.${result.error}`));
              return;
            }
            router.push({ pathname: "/account/academy/[course]", params: { course: slug } });
          })
        }
      >
        {t("course.enroll")}
      </Button>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
