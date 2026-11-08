"use client";

import { MessageSquare } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import type { Comment } from "@/lib/portal";
import type { PortalResult } from "@/lib/portal-actions";

type Props = {
  /** What is commented on, for the accessible name of the thread. */
  name: string;
  count: number;
  load: () => Promise<PortalResult<Comment[]>>;
  add: (body: string) => Promise<PortalResult<Comment[]>>;
};

/** Discussion on a task or a deliverable, loaded on demand. */
export function Comments({ name, count, load, add }: Props) {
  const t = useTranslations("Portal");
  const format = useFormatter();
  const regionId = useId();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function toggle() {
    setOpen(!open);
    if (open || comments) return;
    startTransition(async () => {
      const result = await load();
      if (result.ok) setComments(result.data);
      else setError(t(`errors.${result.error}`));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" size="sm" variant="ghost" aria-expanded={open} aria-controls={regionId} onClick={toggle}>
          <MessageSquare aria-hidden="true" />
          {open ? t("comments.hide") : t("comments.show", { count: comments?.length ?? count })}
        </Button>
      </div>
      {open ? (
        <section id={regionId} aria-label={t("comments.title", { name })} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
          {comments === null && !error ? <p className="text-sm text-muted-foreground">{t("comments.loading")}</p> : null}
          {comments?.length === 0 ? <p className="text-sm text-muted-foreground">{t("comments.empty")}</p> : null}
          {comments && comments.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {comments.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 rounded-md bg-card p-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {c.author?.display_name ?? c.author?.email ?? t("deletedUser")}
                    </span>
                    {c.from_staff ? <> · {t("team")}</> : null} · {format.dateTime(new Date(c.created_at), { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="text-sm whitespace-pre-line">{c.body}</p>
                </li>
              ))}
            </ol>
          ) : null}
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await add(body);
                if (!result.ok) {
                  setError(t(`errors.${result.error}`));
                  return;
                }
                setComments(result.data);
                setBody("");
              });
            }}
          >
            <FormField label={t("comments.label")}>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} required maxLength={5000} rows={3} />
            </FormField>
            <div>
              <Button type="submit" size="sm" variant="secondary" loading={pending}>
                {t("comments.send")}
              </Button>
            </div>
          </form>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
