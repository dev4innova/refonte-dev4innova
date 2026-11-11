"use client";

import { CircleCheck } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type * as React from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { CONTACT_TOPICS, type ContactField, type ContactTopic } from "@/lib/contact/schema";
import { type ContactFormState, initialContactState } from "@/lib/contact/state";

export type ContactFormLabels = {
  fields: Record<"name" | "email" | "company" | "topic" | "message" | "consent", string>;
  messageHelp: string;
  privacyLink: string;
  required: string;
  optional: string;
  submit: string;
  sending: string;
  honeypot: string;
  topics: Record<ContactTopic, string>;
  success: { title: string; text: string };
  errors: Record<ContactField | "summary" | "rateLimited" | "unavailable", string>;
};

type ContactFormProps = {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  labels: ContactFormLabels;
};

/** Website contact form (TASK-055). Works without JavaScript (server action). */
export function ContactForm({ action, labels }: ContactFormProps) {
  const [state, formAction] = useActionState(action, initialContactState);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Move focus to the result so screen reader and keyboard users notice it.
  useEffect(() => {
    if (state.status !== "idle") feedbackRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div
        ref={feedbackRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-8 focus:outline-none"
      >
        <CircleCheck aria-hidden="true" className="size-10 text-primary-ink" />
        <h2 className="text-heading-lg font-semibold">{labels.success.title}</h2>
        <p className="text-muted-foreground">{labels.success.text}</p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : [];
  const values = state.status === "error" ? state.values : undefined;
  const errorFor = (field: ContactField) => (errors.includes(field) ? labels.errors[field] : undefined);
  const formError = state.status === "error" ? state.formError : undefined;

  return (
    <form
      action={formAction}
      // With JavaScript, submit through a transition: React then keeps what the visitor
      // typed (a form `action` resets the fields after each submission). Without
      // JavaScript, the `action` attribute posts the form to the server action.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {state.status === "error" ? (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-destructive bg-accent p-4 text-sm font-medium text-accent-foreground focus:outline-none"
        >
          {formError ? labels.errors[formError] : labels.errors.summary}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={labels.fields.name} required requiredLabel={labels.required} error={errorFor("name")}>
          <Input name="name" autoComplete="name" required minLength={2} maxLength={120} defaultValue={values?.name} />
        </FormField>
        <FormField label={labels.fields.email} required requiredLabel={labels.required} error={errorFor("email")}>
          <Input name="email" type="email" autoComplete="email" required maxLength={320} defaultValue={values?.email} />
        </FormField>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={labels.fields.company} description={labels.optional} error={errorFor("company")}>
          <Input name="company" autoComplete="organization" maxLength={160} defaultValue={values?.company} />
        </FormField>
        <FormField label={labels.fields.topic}>
          <TopicSelect
            // A new result remounts the select with the submitted topic.
            key={values ? JSON.stringify(values) : "initial"}
            initial={values?.topic ?? "project"}
            labels={labels.topics}
          />
        </FormField>
      </div>

      <FormField
        label={labels.fields.message}
        description={labels.messageHelp}
        required
        requiredLabel={labels.required}
        error={errorFor("message")}
      >
        <Textarea name="message" rows={7} required minLength={20} maxLength={5000} defaultValue={values?.message} />
      </FormField>

      {/* Honeypot: invisible to people and assistive technologies, filled in by naive bots. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          {labels.honeypot}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <FormField
          label={labels.fields.consent}
          inline
          required
          requiredLabel={labels.required}
          error={errorFor("consent")}
        >
          <Checkbox name="consent" value="on" />
        </FormField>
        <Link href="/privacy" className="ml-8 text-sm text-primary-ink underline underline-offset-4">
          {labels.privacyLink}
        </Link>
      </div>

      <div>
        <SubmitButton label={labels.submit} pendingLabel={labels.sending} />
      </div>
    </form>
  );
}

/**
 * Controlled select: React resets uncontrolled fields after a form action, and a <select>
 * would lose the visitor's choice when the form comes back with errors.
 */
function TopicSelect({
  initial,
  labels,
  ...props
}: {
  initial: ContactTopic;
  labels: Record<ContactTopic, string>;
} & Omit<React.ComponentProps<"select">, "value" | "onChange" | "defaultValue">) {
  const [topic, setTopic] = useState<ContactTopic>(initial);
  return (
    <select
      {...props}
      name="topic"
      value={topic}
      onChange={(event) => setTopic(event.target.value as ContactTopic)}
      className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground shadow-card focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40"
    >
      {CONTACT_TOPICS.map((value) => (
        <option key={value} value={value}>
          {labels[value]}
        </option>
      ))}
    </select>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
