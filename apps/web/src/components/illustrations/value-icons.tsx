import type { IllustrationProps } from "./illustration";

const VALUE_ICONS = {
  /* Frame: a target, its center in red. */
  strategy: (
    <>
      <circle cx="22" cy="22" r="17" />
      <circle cx="22" cy="22" r="9" />
      <circle cx="22" cy="22" r="2.5" fill="var(--illu-signal)" stroke="none" />
    </>
  ),
  /* Build: code in a window. */
  build: (
    <>
      <rect x="6" y="9" width="32" height="24" rx="3" />
      <path d="M14 18l-4 4 4 4M30 18l4 4-4 4M24 15l-4 14" />
      <path d="M6 37h32" stroke="var(--illu-signal)" />
    </>
  ),
  /* Run: a rising trend. */
  run: (
    <>
      <path d="M8 30l9-9 6 6 13-13" />
      <path d="M28 14h8v8" />
      <path d="M8 37h28" stroke="var(--illu-signal)" />
    </>
  ),
} as const;

/** Pictograms of the three commitments of the value proposition (frame, build, run). */
export function ValueIcon({ name, className }: IllustrationProps & { name: keyof typeof VALUE_ICONS }) {
  return (
    <svg
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-slot="illustration"
      data-illustration={`value-${name}`}
      className={className}
    >
      {VALUE_ICONS[name]}
    </svg>
  );
}
