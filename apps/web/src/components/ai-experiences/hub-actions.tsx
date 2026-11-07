"use client";

import { FileSearch, MessageSquare, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  type ContentInput,
  createAssistantSession,
  createContentSession,
  uploadDocument,
} from "@/app/[locale]/account/ai/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { CONTENT_FORMATS, DOCUMENT_ACCEPT, LENGTHS, TONES } from "@/lib/ai-experiences";

import { useExperienceAction } from "./use-experience-action";

function useOpen(org: string) {
  const router = useRouter();
  return (id: string) =>
    router.push({ pathname: "/account/ai/[org]/[session]", params: { org, session: id } });
}

function Card({ icon: Icon, id, title, text, children }: { icon: typeof MessageSquare; id: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-heading-sm font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The three AI experiences of an organization (TASK-083 to TASK-085). */
export function HubActions({ org, locale }: { org: string; locale: "fr" | "en" }) {
  const t = useTranslations("AI");
  const open = useOpen(org);
  const assistant = useExperienceAction();
  const document = useExperienceAction();
  const content = useExperienceAction();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card icon={MessageSquare} id="ai-assistant" title={t("assistant.title")} text={t("assistant.text")}>
        <div className="mt-auto flex flex-col gap-2">
          <Button loading={assistant.pending} onClick={() => assistant.run(() => createAssistantSession(org), ({ id }) => open(id))}>
            {t("assistant.start")}
          </Button>
          {assistant.error ? <p role="alert" className="text-sm font-medium text-destructive">{assistant.error}</p> : null}
        </div>
      </Card>

      <Card icon={FileSearch} id="ai-document" title={t("document.title")} text={t("document.text")}>
        <form
          className="mt-auto flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            document.run(() => uploadDocument(org, data), ({ id }) => open(id));
          }}
        >
          <FormField label={t("document.file")} description={t("document.fileHelp")} required requiredLabel={t("required")}>
            <Input name="file" type="file" accept={DOCUMENT_ACCEPT} required className="h-auto py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium" />
          </FormField>
          <Button type="submit" variant="secondary" loading={document.pending}>
            {document.pending ? t("document.reading") : t("document.analyze")}
          </Button>
          {document.error ? <p role="alert" className="text-sm font-medium text-destructive">{document.error}</p> : null}
        </form>
      </Card>

      <Card icon={PenLine} id="ai-content" title={t("content.title")} text={t("content.text")}>
        <form
          className="mt-auto flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const text = (key: string) => String(data.get(key) ?? "");
            const input = {
              format: text("format"),
              tone: text("tone"),
              language: text("language") === "en" ? "en" : "fr",
              length: text("length"),
              topic: text("topic"),
              details: text("details"),
            } as ContentInput;
            content.run(() => createContentSession(org, input), ({ id }) => open(id));
          }}
        >
          <FormField label={t("content.topic")} required requiredLabel={t("required")}>
            <Input name="topic" required minLength={3} maxLength={300} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("content.format")}>
              <NativeSelect name="format" size="sm" defaultValue="linkedin_post">
                {CONTENT_FORMATS.map((f) => <option key={f} value={f}>{t(`formats.${f}`)}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label={t("content.tone")}>
              <NativeSelect name="tone" size="sm" defaultValue="professional">
                {TONES.map((v) => <option key={v} value={v}>{t(`tones.${v}`)}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label={t("content.length")}>
              <NativeSelect name="length" size="sm" defaultValue="medium">
                {LENGTHS.map((v) => <option key={v} value={v}>{t(`lengths.${v}`)}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label={t("content.language")}>
              <NativeSelect name="language" size="sm" defaultValue={locale}>
                <option value="fr">{t("languages.fr")}</option>
                <option value="en">{t("languages.en")}</option>
              </NativeSelect>
            </FormField>
          </div>
          <FormField label={t("content.details")} description={t("content.detailsHelp")}>
            <Textarea name="details" rows={3} maxLength={4000} />
          </FormField>
          <Button type="submit" variant="secondary" loading={content.pending}>{t("content.generate")}</Button>
          {content.error ? <p role="alert" className="text-sm font-medium text-destructive">{content.error}</p> : null}
        </form>
      </Card>
    </div>
  );
}
