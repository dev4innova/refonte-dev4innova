"use client";

import { ExternalLink, Eye, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import {
  type ActionError,
  deleteDocument,
  type DocumentInput,
  previewMarkdown,
  saveDocument,
  setPublished,
} from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_ICONS } from "@/config/offer";
import { Link, useRouter } from "@/i18n/navigation";
import type { AdminDocument, AdminMedia, DocumentType } from "@/lib/admin";
import { slugDraft, slugify } from "@/lib/slugify";
import { cn } from "@/lib/utils";

import { StatusBadge } from "./status-badge";

const LOCALES = ["fr", "en"] as const;
type EditorLocale = (typeof LOCALES)[number];

type TranslationFields = {
  slug: string;
  title: string;
  summary: string;
  body_md: string;
  seo_title: string;
  seo_description: string;
};

const EMPTY: TranslationFields = {
  slug: "",
  title: "",
  summary: "",
  body_md: "",
  seo_title: "",
  seo_description: "",
};

const PUBLIC_PATHS = {
  service: "/services/[slug]",
  article: "/insights/[slug]",
  project: "/portfolio/[slug]",
} as const;

type Feedback = { kind: "success" | "error"; text: string } | null;

type DocumentEditorProps = {
  type: DocumentType;
  initial: AdminDocument | null;
  media: AdminMedia[];
  /** The document was just created: confirm it. */
  justSaved?: boolean;
};

/** Back-office editor of one CMS document, in French and English (TASK-059 to TASK-066). */
export function DocumentEditor({ type, initial, media, justSaved = false }: DocumentEditorProps) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [document, setDocument] = useState(initial);
  const [locale, setLocale] = useState<EditorLocale>("fr");
  const [translations, setTranslations] = useState<Record<EditorLocale, TranslationFields>>(() => {
    const byLocale = Object.fromEntries(initial?.translations.map((tr) => [tr.locale, tr]) ?? []);
    return {
      fr: { ...EMPTY, ...byLocale.fr },
      en: { ...EMPTY, ...byLocale.en },
    };
  });
  const [slugTouched, setSlugTouched] = useState<Record<EditorLocale, boolean>>({
    fr: Boolean(initial),
    en: Boolean(initial),
  });
  const [attributes, setAttributes] = useState<Record<string, string>>(initial?.attributes ?? {});
  const [position, setPosition] = useState(initial?.position ?? 0);
  const [coverId, setCoverId] = useState<string | null>(initial?.cover?.id ?? null);
  const [feedback, setFeedback] = useState<Feedback>(
    justSaved ? { kind: "success", text: t("editor.saved") } : null,
  );

  const current = translations[locale];
  const errorText = (error: ActionError) =>
    t(`editor.errors.${error === "invalidImage" || error === "tooLarge" || error === "signin" ? "generic" : error}`);

  function update(field: keyof TranslationFields, value: string) {
    setTranslations((previous) => {
      const next = { ...previous[locale], [field]: value };
      if (field === "title" && !slugTouched[locale]) next.slug = slugify(value);
      return { ...previous, [locale]: next };
    });
    if (field === "slug") setSlugTouched((previous) => ({ ...previous, [locale]: true }));
  }

  function input(): DocumentInput {
    return { type, translations, attributes, position, coverMediaId: coverId };
  }

  function save() {
    startTransition(async () => {
      const result = await saveDocument(document?.id ?? null, input());
      if (!result.ok) return setFeedback({ kind: "error", text: errorText(result.error) });
      setFeedback({ kind: "success", text: t("editor.saved") });
      if (!document) {
        // Continue on the edit page, which confirms the save (?saved=1).
        router.replace({
          pathname: "/admin/content/[type]/[id]",
          params: { type, id: result.data.id },
          query: { saved: "1" },
        });
        return;
      }
      setDocument(result.data);
    });
  }

  function togglePublished() {
    if (!document) return;
    const publish = document.status !== "published";
    startTransition(async () => {
      // Save pending edits first, so what gets published is what is on screen.
      const saved = await saveDocument(document.id, input());
      if (!saved.ok) return setFeedback({ kind: "error", text: errorText(saved.error) });
      const result = await setPublished(document.id, type, publish);
      if (!result.ok) return setFeedback({ kind: "error", text: errorText(result.error) });
      setDocument(result.data);
      setFeedback({ kind: "success", text: t(publish ? "editor.published" : "editor.unpublished") });
    });
  }

  function remove() {
    if (!document || !window.confirm(t("editor.deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteDocument(document.id, type);
      if (!result.ok) return setFeedback({ kind: "error", text: errorText(result.error) });
      router.push({ pathname: "/admin/content/[type]", params: { type } });
    });
  }

  const publicSlug = document?.translations.find((tr) => tr.locale === locale)?.slug;
  const publicPath = type in PUBLIC_PATHS ? PUBLIC_PATHS[type as keyof typeof PUBLIC_PATHS] : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href={{ pathname: "/admin/content/[type]", params: { type } }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("editor.back")}
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-display-md font-semibold">
            {document ? t("editor.editTitle") : t("editor.newTitle")}
            <span className="text-base font-normal text-muted-foreground">· {t(`types.${type}`)}</span>
            {document ? (
              <StatusBadge status={document.status} label={t(`status.${document.status}`)} />
            ) : null}
          </h1>
        </div>
        {document?.status === "published" && publicPath && publicSlug ? (
          <Button asChild variant="outline" size="sm">
            <Link href={{ pathname: publicPath, params: { slug: publicSlug } }} locale={locale} target="_blank">
              {t("editor.viewOnSite")}
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border p-4 text-sm font-medium",
            feedback.kind === "error"
              ? "border-destructive bg-accent text-accent-foreground"
              : "border-border bg-card",
          )}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
          <div role="tablist" aria-label={t("editor.languages")} className="flex gap-1 border-b border-border">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                id={`tab-${l}`}
                aria-selected={locale === l}
                aria-controls="translation-panel"
                onClick={() => setLocale(l)}
                className={cn(
                  "-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground",
                  "focus-visible:outline-2 focus-visible:outline-ring aria-selected:border-primary aria-selected:text-foreground",
                )}
              >
                {t(`editor.${l}`)}
                {translations[l].title ? null : <span aria-hidden="true"> ○</span>}
              </button>
            ))}
          </div>

          <div id="translation-panel" role="tabpanel" aria-labelledby={`tab-${locale}`} className="flex flex-col gap-6">
            <FormField label={t("editor.title")} key={`title-${locale}`}>
              <Input value={current.title} onChange={(e) => update("title", e.target.value)} maxLength={200} />
            </FormField>
            <FormField label={t("editor.slug")} description={t("editor.slugHelp")} key={`slug-${locale}`}>
              <Input
                value={current.slug}
                onChange={(e) => update("slug", slugDraft(e.target.value))}
                onBlur={(e) => update("slug", slugify(e.target.value))}
                maxLength={120}
                spellCheck={false}
                className="font-mono text-sm"
              />
            </FormField>
            <FormField label={t("editor.summary")} description={t("editor.summaryHelp")} key={`summary-${locale}`}>
              <Textarea value={current.summary} onChange={(e) => update("summary", e.target.value)} rows={3} maxLength={500} />
            </FormField>
            <MarkdownField
              key={`body-${locale}`}
              value={current.body_md}
              onChange={(value) => update("body_md", value)}
            />
            <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold">{t("editor.seo")}</legend>
              <p className="text-sm text-muted-foreground">{t("editor.seoHelp")}</p>
              <FormField
                key={`seo-title-${locale}`}
                label={t("editor.seoTitle")}
                description={t("editor.characters", { count: current.seo_title.length, max: 70 })}
              >
                <Input value={current.seo_title} onChange={(e) => update("seo_title", e.target.value)} maxLength={70} />
              </FormField>
              <FormField
                key={`seo-description-${locale}`}
                label={t("editor.seoDescription")}
                description={t("editor.characters", { count: current.seo_description.length, max: 170 })}
              >
                <Textarea
                  value={current.seo_description}
                  onChange={(e) => update("seo_description", e.target.value)}
                  rows={2}
                  maxLength={170}
                />
              </FormField>
            </fieldset>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-heading-sm font-semibold">{t("editor.settings")}</h2>
            {type === "service" ? (
              <FormField label={t("editor.icon")}>
                <select
                  value={attributes.icon ?? "sparkles"}
                  onChange={(e) => setAttributes({ ...attributes, icon: e.target.value })}
                  className="h-11 w-full rounded-lg border border-input bg-card px-3"
                >
                  {Object.keys(CONTENT_ICONS).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            {type === "project" ? (
              <>
                <FormField label={t("editor.industry")}>
                  <Input
                    value={attributes.industry ?? ""}
                    onChange={(e) => setAttributes({ ...attributes, industry: e.target.value })}
                    maxLength={200}
                  />
                </FormField>
                <FormField label={t("editor.client")}>
                  <Input
                    value={attributes.client ?? ""}
                    onChange={(e) => setAttributes({ ...attributes, client: e.target.value })}
                    maxLength={200}
                  />
                </FormField>
              </>
            ) : null}
            {type === "service" || type === "project" ? (
              <FormField label={t("editor.position")}>
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value) || 0)}
                />
              </FormField>
            ) : null}
            <FormField label={t("editor.cover")}>
              <select
                value={coverId ?? ""}
                onChange={(e) => setCoverId(e.target.value || null)}
                className="h-11 w-full rounded-lg border border-input bg-card px-3"
              >
                <option value="">{t("editor.noCover")}</option>
                {media.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alt_fr || m.filename}
                  </option>
                ))}
              </select>
            </FormField>
            {coverId ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from storage
              <img
                src={media.find((m) => m.id === coverId)?.url}
                alt=""
                className="aspect-video w-full rounded-lg border border-border object-cover"
              />
            ) : null}
            <Link href="/admin/media" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t("editor.manageMedia")}
            </Link>
          </section>

          <div className="flex flex-col gap-3">
            <Button onClick={save} loading={pending} size="lg">
              {pending ? t("editor.saving") : t("editor.save")}
            </Button>
            {document ? (
              <Button onClick={togglePublished} disabled={pending} variant={document.status === "published" ? "outline" : "secondary"}>
                {document.status === "published" ? t("editor.unpublish") : t("editor.publish")}
              </Button>
            ) : null}
            {document && document.status === "draft" ? (
              <Button onClick={remove} disabled={pending} variant="ghost" className="text-destructive">
                <Trash2 aria-hidden="true" />
                {t("editor.delete")}
              </Button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Markdown textarea with a preview rendered by the API, exactly as on the website. */
function MarkdownField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("Admin");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [html, setHtml] = useState("");
  const [loading, startTransition] = useTransition();
  const id = useId();

  function showPreview() {
    setMode("preview");
    startTransition(async () => {
      const result = await previewMarkdown(value);
      setHtml(result.ok ? result.data : "");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {t("editor.body")}
        </span>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant={mode === "write" ? "secondary" : "ghost"} onClick={() => setMode("write")} aria-pressed={mode === "write"}>
            <Pencil aria-hidden="true" />
            {t("editor.write")}
          </Button>
          <Button type="button" size="sm" variant={mode === "preview" ? "secondary" : "ghost"} onClick={showPreview} aria-pressed={mode === "preview"}>
            <Eye aria-hidden="true" />
            {t("editor.preview")}
          </Button>
        </div>
      </div>
      {mode === "write" ? (
        <>
          <Textarea
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-help`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={16}
            className="font-mono text-sm"
          />
          <p id={`${id}-help`} className="text-sm text-muted-foreground">
            {t("editor.bodyHelp")}
          </p>
        </>
      ) : (
        <div aria-busy={loading} className="min-h-64 rounded-lg border border-border p-6">
          {html ? (
            // Sanitized by the API (same renderer as the public website).
            <div className="prose-d4i" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-muted-foreground">{loading ? "…" : t("editor.previewEmpty")}</p>
          )}
        </div>
      )}
    </div>
  );
}
