"use client";

import { CircleCheck } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef } from "react";
import type * as React from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { AuthField, AuthFieldError, AuthFormError, AuthFormState } from "@/lib/auth/forms";
import { initialAuthState } from "@/lib/auth/forms";

export type AuthFieldConfig = {
  name: AuthField;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  description?: string;
};

export type AuthFormLabels = {
  submit: string;
  sending: string;
  required: string;
  summary: string;
  fieldErrors: Record<AuthFieldError, string>;
  formErrors: Record<AuthFormError, string>;
  /** Shown instead of the form once the action succeeded (password change). */
  success?: { title: string; text: string };
  /** Staff password reset: shown with the temporary password. */
  temporaryPassword?: { title: string; text: string };
};

type AuthFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: AuthFieldConfig[];
  labels: AuthFormLabels;
  /** Under the submit button (e.g. "No account yet? Sign up"). */
  footer?: React.ReactNode;
};

/** Account forms (ADR-0019): sign-in, sign-up, password change and reset. Work without
 * JavaScript (server actions); errors are announced and get the focus. */
export function AuthForm({ action, fields, labels, footer }: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthState);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== "idle") feedbackRef.current?.focus();
    // Passwords are never kept after a submission.
    if (state.status !== "idle") {
      formRef.current?.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => {
        input.value = "";
      });
    }
  }, [state]);

  if (state.status === "success" && labels.success && !state.temporaryPassword) {
    return (
      <div ref={feedbackRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 focus:outline-none">
        <CircleCheck aria-hidden="true" className="size-8 text-primary-ink" />
        <p className="text-heading-md font-semibold">{labels.success.title}</p>
        <p className="text-muted-foreground">{labels.success.text}</p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : {};
  const values = state.status === "error" ? state.values : {};
  const formError = state.status === "error" ? state.formError : undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      // Through a transition with JavaScript, so React keeps the typed values.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {state.status === "error" ? (
        <div ref={feedbackRef} tabIndex={-1} role="alert" className="rounded-lg border border-destructive bg-accent p-4 text-sm font-medium text-accent-foreground focus:outline-none">
          {formError ? labels.formErrors[formError] : labels.summary}
        </div>
      ) : null}
      {state.status === "success" && state.temporaryPassword && labels.temporaryPassword ? (
        <div ref={feedbackRef} tabIndex={-1} role="status" className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-accent/40 p-4 focus:outline-none">
          <p className="font-semibold">
            {labels.temporaryPassword.title}
            {state.email ? ` — ${state.email}` : null}
          </p>
          <p className="text-sm text-muted-foreground">{labels.temporaryPassword.text}</p>
          <p>
            <code className="rounded bg-muted px-2 py-1 font-mono text-base select-all">{state.temporaryPassword}</code>
          </p>
        </div>
      ) : null}

      {fields.map((field) => {
        const error = errors[field.name];
        return (
          <FormField
            key={field.name}
            label={field.label}
            description={field.description}
            required
            requiredLabel={labels.required}
            error={error ? labels.fieldErrors[error] : undefined}
          >
            <Input
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              required
              maxLength={field.type === "password" ? 128 : field.type === "email" ? 320 : 200}
              defaultValue={field.type === "password" ? undefined : values[field.name as "name" | "email"]}
            />
          </FormField>
        );
      })}

      <SubmitButton label={labels.submit} sending={labels.sending} />
      {footer}
    </form>
  );
}

function SubmitButton({ label, sending }: { label: string; sending: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending} className="self-start">
      {pending ? sending : label}
    </Button>
  );
}
