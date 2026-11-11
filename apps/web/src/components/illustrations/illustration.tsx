import type * as React from "react";

import { cn } from "@/lib/utils";

export type IllustrationProps = { className?: string };

/**
 * Root of every illustration: decorative (hidden from assistive technologies, whose text
 * equivalent is in the page), colored only by currentColor and the --illu-* variables, so
 * it adapts to light and dark ([data-variant="inverse"]) surfaces. No script, no request.
 */
export function IllustrationSvg({
  viewBox,
  name,
  className,
  children,
}: {
  viewBox: string;
  name: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-slot="illustration"
      data-illustration={name}
      className={cn("block h-auto w-full", className)}
    >
      {children}
    </svg>
  );
}

/** Panel behind an illustration: reserves its space with an aspect ratio (no layout shift). */
export function IllustrationPanel({
  ratio = "video",
  className,
  children,
}: {
  ratio?: "video" | "wide" | "square";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="illustration-panel"
      className={cn(
        "grid place-items-center overflow-hidden rounded-lg bg-(--illu-backdrop)",
        ratio === "video" && "aspect-video",
        ratio === "wide" && "aspect-video lg:aspect-[21/8]",
        ratio === "square" && "aspect-square",
        "[&>*]:size-full [&_svg]:size-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small capitals label used inside illustrations. */
export const LABEL = {
  className: "font-heading",
  fontSize: 11,
  letterSpacing: 1.5,
  fill: "var(--illu-label)",
} as const;

export const TEXT = { className: "font-sans", fontSize: 11, fill: "var(--illu-ink)" } as const;
