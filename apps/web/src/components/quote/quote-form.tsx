"use client";

import { CircleCheck } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import {
  initialQuoteState,
  QUOTE_BUDGETS,
  QUOTE_TIMELINES,
  type QuoteBudget,
  type QuoteField,
  type QuoteFormState,
  type QuoteTimeline,
} from "@/lib/quote/schema";

export type QuoteFormLabels = {
  fields: Record<
    "name" | "email" | "company" | "phone" | "service" | "need" | "budget" | "timeline" | "consent",
    string
  >;
  needHelp: string;
  anyService: string;
  privacyLink: string;
  required: string;
  optional: string;
  submit: string;
  sending: string;
  honeypot: string;
  budgets: Record<QuoteBudget, string>;
  timelines: Record<QuoteTimeline, string>;
  success: { title: string; text: string };
  errors: Record<QuoteField | "summary" | "rateLimited" | "unavailable", string>;
};

type QuoteFormProps = {
  action: (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;
  labels: QuoteFormLabels;
  /** Published services, by slug. */
  services: { slug: string; title: string }[];
  /** Service chosen beforehand (link from a service page). */
  initialService?: string;
};

/** Website quote request form (TASK-072). Works without JavaScript (server action). */
export function QuoteForm({ action, labels, services, initialService = "" }: QuoteFormProps) {
  const [state, formAction] = useActionState(action, initialQuoteState);
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
        <CircleCheck aria-hidden="true" className="size-10 text-primary" />
        <h2 className="text-heading-lg font-semibold">{labels.success.title}</h2>
        <p className="text-muted-foreground">{labels.success.text}</p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : [];
  const values = state.status === "error" ? state.values : undefined;
  const errorFor = (field: QuoteField) => (errors.includes(field) ? labels.errors[field] : undefined);
  const formError = state.status === "error" ? state.formError : undefined;
  const known = services.some((s) => s.slug === initialService) ? initialService : "";
  // A new result remounts the selects with the submitted values (React resets form fields
  // after an action, and an uncontrolled <select> would lose the visitor's choice).
  const remount = values ? JSON.stringify(values) : "initial";

  return (
    <form
      action={formAction}
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
        <FormField label={labels.fields.company} description={labels.optional} error={errorFor("company")}>
          <Input name="company" autoComplete="organization" maxLength={160} defaultValue={values?.company} />
        </FormField>
        <FormField label={labels.fields.phone} description={labels.optional} error={errorFor("phone")}>
          <Input name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={values?.phone} />
        </FormField>
      </div>

      <FormField label={labels.fields.service}>
        <NativeSelect key={`service-${remount}`} name="service" defaultValue={values?.service ?? known}>
          <option value="">{labels.anyService}</option>
          {services.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.title}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField
        label={labels.fields.need}
        description={labels.needHelp}
        required
        requiredLabel={labels.required}
        error={errorFor("need")}
      >
        <Textarea name="need" rows={7} required minLength={20} maxLength={5000} defaultValue={values?.need} />
      </FormField>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={labels.fields.budget}>
          <NativeSelect key={`budget-${remount}`} name="budget" defaultValue={values?.budget ?? "unknown"}>
            {QUOTE_BUDGETS.map((value) => (
              <option key={value} value={value}>
                {labels.budgets[value]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={labels.fields.timeline}>
          <NativeSelect key={`timeline-${remount}`} name="timeline" defaultValue={values?.timeline ?? "unknown"}>
            {QUOTE_TIMELINES.map((value) => (
              <option key={value} value={value}>
                {labels.timelines[value]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

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
        <Link href="/privacy" className="ml-8 text-sm text-primary underline underline-offset-4">
          {labels.privacyLink}
        </Link>
      </div>

      <div>
        <SubmitButton label={labels.submit} pendingLabel={labels.sending} />
      </div>
    </form>
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
