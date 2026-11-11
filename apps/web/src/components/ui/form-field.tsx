"use client";

import { Slot } from "radix-ui";
import { useId } from "react";
import type * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FormFieldProps = {
  /** Visible label (translated by the caller). */
  label: React.ReactNode;
  /** Help text linked to the control with aria-describedby. */
  description?: React.ReactNode;
  /** Error message; marks the control aria-invalid and is announced to screen readers. */
  error?: React.ReactNode;
  /** Adds aria-required on the control and a visual marker after the label. */
  required?: boolean;
  /** Accessible text of the required marker, e.g. "obligatoire" / "required". */
  requiredLabel?: string;
  /** Places the label after the control (checkboxes). */
  inline?: boolean;
  className?: string;
  /** A single form control (Input, Textarea, Checkbox…), wired automatically. */
  children: React.ReactElement;
};

/**
 * Wires a label, a description and an error message to one form control:
 * id/htmlFor, aria-describedby, aria-invalid and aria-required are set for you.
 */
export function FormField({
  label,
  description,
  error,
  required = false,
  requiredLabel,
  inline = false,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const labelNode = (
    <Label htmlFor={controlId}>
      {label}
      {required ? (
        <span className="text-primary-ink">
          <span aria-hidden="true">*</span>
          {requiredLabel ? <span className="sr-only">{requiredLabel}</span> : null}
        </span>
      ) : null}
    </Label>
  );

  const control = (
    <Slot.Root
      id={controlId}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
    >
      {children}
    </Slot.Root>
  );

  return (
    <div data-slot="form-field" className={cn("flex flex-col gap-2", className)}>
      {inline ? (
        <div className="flex items-start gap-3">
          {control}
          {labelNode}
        </div>
      ) : (
        <>
          {labelNode}
          {control}
        </>
      )}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
