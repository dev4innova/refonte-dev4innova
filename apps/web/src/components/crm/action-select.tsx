"use client";

import { useId, useState } from "react";

import type { CrmResult } from "@/app/[locale]/admin/crm/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { useCrmAction } from "./use-crm-action";

type ActionSelectProps = {
  label: string;
  /** Hide the label visually (it stays the accessible name). */
  hideLabel?: boolean;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => Promise<CrmResult>;
  size?: "sm" | "md";
  className?: string;
};

/** A select that saves as soon as the value changes (status, stage, owner...). */
export function ActionSelect({ label, hideLabel, value, options, onChange, size = "sm", className }: ActionSelectProps) {
  const id = useId();
  const { pending, error, run } = useCrmAction();
  const [current, setCurrent] = useState(value);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={cn("text-xs font-medium text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </label>
      <NativeSelect
        id={id}
        size={size}
        value={current}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          const previous = current;
          setCurrent(next);
          run(
            async () => {
              const result = await onChange(next);
              if (!result.ok) setCurrent(previous);
              return result;
            },
          );
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
