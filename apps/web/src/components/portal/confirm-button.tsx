"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PortalResult } from "@/lib/portal-actions";

import { usePortalAction } from "./use-portal-action";

type Props = {
  action: () => Promise<PortalResult>;
  /** Visible label; `label` is the accessible name when it differs (e.g. names the item). */
  children: React.ReactNode;
  label?: string;
  confirm: string;
  onDone?: () => void;
  variant?: "ghost" | "outline";
};

/** A destructive action, confirmed first (delete a file, a task, a project...). */
export function ConfirmButton({ action, children, label, confirm, onDone, variant = "ghost" }: Props) {
  const { pending, error, run } = usePortalAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        aria-label={label}
        loading={pending}
        onClick={() => {
          if (!window.confirm(confirm)) return;
          run(action, onDone);
        }}
      >
        <Trash2 aria-hidden="true" />
        {children}
      </Button>
      {error ? <span role="alert" className="text-xs font-medium text-destructive">{error}</span> : null}
    </span>
  );
}
