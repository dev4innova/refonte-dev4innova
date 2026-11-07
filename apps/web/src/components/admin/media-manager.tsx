"use client";

import { Copy, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { deleteMedia, updateMediaAlt, uploadMedia } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { AdminMedia } from "@/lib/admin";
import { cn } from "@/lib/utils";

type Feedback = { kind: "success" | "error"; text: string } | null;

/** Media library: upload, alternative texts, deletion (TASK-065). */
export function MediaManager({ media }: { media: AdminMedia[] }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function upload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadMedia(formData);
      if (!result.ok) {
        const key = result.error === "tooLarge" ? "tooLarge" : result.error === "invalidImage" ? "invalid" : "generic";
        return setFeedback({ kind: "error", text: t(`media.errors.${key}`) });
      }
      formRef.current?.reset();
      setFeedback({ kind: "success", text: t("media.uploaded") });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-md font-semibold">{t("media.title")}</h1>

      <form
        ref={formRef}
        action={upload}
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-end"
      >
        <FormField label={t("media.file")} description={t("media.uploadHelp")} className="flex-1">
          <Input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="py-2" />
        </FormField>
        <Button type="submit" loading={pending}>
          <Upload aria-hidden="true" />
          {pending ? t("media.uploading") : t("media.upload")}
        </Button>
      </form>

      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border p-4 text-sm font-medium",
            feedback.kind === "error" ? "border-destructive bg-accent text-accent-foreground" : "border-border bg-card",
          )}
        >
          {feedback.text}
        </p>
      ) : null}

      {media.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">
          {t("media.empty")}
        </p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {media.map((item) => (
            <MediaItem key={item.id} item={item} onFeedback={setFeedback} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaItem({ item, onFeedback }: { item: AdminMedia; onFeedback: (f: Feedback) => void }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [altFr, setAltFr] = useState(item.alt_fr);
  const [altEn, setAltEn] = useState(item.alt_en);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveAlt() {
    startTransition(async () => {
      const result = await updateMediaAlt(item.id, altFr, altEn);
      onFeedback(result.ok ? null : { kind: "error", text: t("media.errors.generic") });
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(t("media.deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteMedia(item.id);
      if (!result.ok) onFeedback({ kind: "error", text: t("media.errors.generic") });
      router.refresh();
    });
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li
      aria-labelledby={`media-${item.id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from storage */}
      <img src={item.url} alt={altFr} className="aspect-video w-full bg-muted object-contain" />
      <div className="flex flex-col gap-4 p-5">
        <h2 id={`media-${item.id}`} className="truncate text-sm font-semibold">
          {item.filename}
        </h2>
        <p className="truncate text-sm text-muted-foreground">
          {item.width}×{item.height} ·{" "}
          {t("media.size", { size: Math.round(item.size_bytes / 1024) })}
        </p>
        <FormField label={t("media.altFr")} description={t("media.altHelp")}>
          <Input value={altFr} onChange={(e) => setAltFr(e.target.value)} maxLength={300} />
        </FormField>
        <FormField label={t("media.altEn")}>
          <Input value={altEn} onChange={(e) => setAltEn(e.target.value)} maxLength={300} />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={saveAlt} loading={pending}>
            {t("media.saveAlt")}
          </Button>
          <Button size="sm" variant="outline" onClick={copyUrl}>
            <Copy aria-hidden="true" />
            <span aria-live="polite">{copied ? t("media.copied") : t("media.copyUrl")}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending} className="text-destructive">
            <Trash2 aria-hidden="true" />
            {t("media.delete")}
          </Button>
        </div>
      </div>
    </li>
  );
}
