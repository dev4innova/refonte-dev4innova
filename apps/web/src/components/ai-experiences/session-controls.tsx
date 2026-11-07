"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { deleteAllSessions, deleteSession, renameSession } from "@/app/[locale]/account/ai/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

import { useExperienceAction } from "./use-experience-action";

/** Rename or delete one session. */
export function SessionControls({ org, id, title }: { org: string; id: string; title: string }) {
  const t = useTranslations("AI");
  const router = useRouter();
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useExperienceAction();

  return (
    <div className="flex flex-col gap-2">
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get("title") ?? "");
            run(() => renameSession(org, id, value), () => setEditing(false));
          }}
        >
          <label htmlFor={inputId} className="sr-only">{t("session.title")}</label>
          <Input id={inputId} name="title" defaultValue={title} maxLength={200} required className="h-9 w-72 max-w-full text-sm" autoFocus />
          <Button type="submit" size="sm" loading={pending}>{t("save")}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("cancel")}</Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{t("session.rename")}</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            loading={pending}
            onClick={() => {
              if (!window.confirm(t("session.deleteConfirm"))) return;
              run(() => deleteSession(org, id), () => router.replace({ pathname: "/account/ai/[org]", params: { org } }));
            }}
          >
            <Trash2 aria-hidden="true" />
            {t("session.delete")}
          </Button>
        </div>
      )}
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

/** Deletes every session of the user in this organization. */
export function DeleteAllSessions({ org }: { org: string }) {
  const t = useTranslations("AI");
  const { pending, error, run } = useExperienceAction();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        loading={pending}
        onClick={() => {
          if (window.confirm(t("history.deleteAllConfirm"))) run(() => deleteAllSessions(org));
        }}
      >
        <Trash2 aria-hidden="true" />
        {t("history.deleteAll")}
      </Button>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
