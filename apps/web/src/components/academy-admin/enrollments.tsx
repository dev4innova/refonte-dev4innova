"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { enrollMembers, listMembers, type Member, removeEnrollment } from "@/app/[locale]/admin/academy/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";

import { useAcademyAction } from "./use-academy-action";

/** Enrolls members of a client organization in a course (TASK-106). */
export function EnrollPanel({ courseId, organizations }: { courseId: string; organizations: { id: string; name: string; slug: string }[] }) {
  const t = useTranslations("Admin.academy");
  const groupId = useId();
  const [organization, setOrganization] = useState("");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { pending, error, run } = useAcademyAction();

  function load(id: string) {
    setOrganization(id);
    setMembers(null);
    setSelected([]);
    setMessage(null);
    if (!id) return;
    startLoading(async () => {
      const result = await listMembers(courseId, id);
      if (result.ok) setMembers(result.data);
      else setLoadError(t(`errors.${result.error}`));
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => enrollMembers(courseId, organization, selected), ({ enrolled }) => {
          load(organization);
          setMessage(t("enrollments.result", { enrolled }));
        });
      }}
    >
      <FormField label={t("enrollments.organization")}>
        <NativeSelect value={organization} onChange={(e) => load(e.target.value)}>
          <option value="">{t("enrollments.choose")}</option>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}
        </NativeSelect>
      </FormField>
      {loading ? <p className="text-sm text-muted-foreground" aria-live="polite">…</p> : null}
      {loadError ? <p role="alert" className="text-sm font-medium text-destructive">{loadError}</p> : null}
      {members ? (
        members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("enrollments.noMember")}</p>
        ) : (
          <fieldset aria-labelledby={groupId} className="flex flex-col gap-2">
            <legend id={groupId} className="mb-1 text-sm font-medium">{t("enrollments.members")}</legend>
            {members.map((m) => (
              <label key={m.id} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  disabled={m.enrolled}
                  checked={m.enrolled || selected.includes(m.id)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, m.id] : selected.filter((id) => id !== m.id))}
                />
                {m.name}
                {m.enrolled ? <span className="text-muted-foreground">({t("enrollments.alreadyEnrolled")})</span> : null}
              </label>
            ))}
          </fieldset>
        )
      ) : null}
      <div>
        <Button type="submit" variant="secondary" loading={pending} disabled={selected.length === 0}>{t("enrollments.enroll")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {message && !error ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function RemoveEnrollment({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Admin.academy.enrollments");
  const { pending, error, run } = useAcademyAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        loading={pending}
        aria-label={t("removeName", { name })}
        onClick={() => {
          if (window.confirm(t("removeConfirm", { name }))) run(() => removeEnrollment(id));
        }}
      >
        {t("remove")}
      </Button>
      {error ? <span role="alert" className="text-xs font-medium text-destructive">{error}</span> : null}
    </span>
  );
}
