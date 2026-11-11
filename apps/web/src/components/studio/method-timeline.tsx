import type * as React from "react";

import { cn } from "@/lib/utils";

export type MethodStep = {
  key: string;
  title: string;
  text: string;
  /** "Livrable : …", already translated. */
  deliverable?: string;
};

/**
 * The method as a real ordered list: numbered markers joined by a line; the last segment is
 * dashed red, the loop back to the first step. Vertical on mobile, 2 × 2 on tablet, vertical
 * again next to the loop diagram on desktop (the page decides the surrounding layout).
 */
export function MethodTimeline({
  steps,
  className,
  ...props
}: { steps: MethodStep[] } & React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="method-timeline"
      className={cn("grid list-none gap-0 p-0 md:grid-cols-2 md:gap-x-10 lg:grid-cols-1", className)}
      {...props}
    >
      {steps.map((step, index) => (
        <li
          key={step.key}
          className={cn(
            "relative pb-7 pl-13",
            "after:absolute after:top-10 after:bottom-1 after:left-[1.125rem] after:w-px after:bg-border",
            "last:after:w-0 last:after:border-l last:after:border-dashed last:after:border-primary last:after:bg-transparent",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 grid size-9 place-items-center rounded-full border border-foreground bg-card font-heading text-eyebrow font-semibold font-numeric tracking-normal"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-heading text-heading-sm font-semibold sm:text-xl">{step.title}</h3>
          <p className="mt-1 text-muted-foreground">{step.text}</p>
          {step.deliverable ? (
            <p className="mt-2 font-heading text-sm font-medium text-muted-foreground">
              {step.deliverable}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Decorative loop diagram of the four steps (the list above carries the information). */
export function MethodLoop({ className }: { className?: string }) {
  const nodes = [
    { x: 120, y: 20, label: "01" },
    { x: 240, y: 20, label: "02" },
    { x: 290, y: 70, label: "03" },
    { x: 120, y: 120, label: "04" },
  ];
  return (
    <svg
      viewBox="0 0 360 140"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-slot="method-loop"
      className={cn("w-full max-w-sm", className)}
    >
      <path
        d="M70 70a50 50 0 0 1 50-50h120a50 50 0 0 1 0 100H120a50 50 0 0 1-50-50z"
        stroke="var(--illu-stroke)"
        strokeWidth="1.5"
      />
      <path
        d="M290 70a50 50 0 0 1-50 50H120"
        stroke="var(--illu-signal)"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      {nodes.map((node) => (
        <g key={node.label}>
          <circle
            cx={node.x}
            cy={node.y}
            r="11"
            fill="var(--illu-fill)"
            stroke="var(--illu-ink)"
            strokeWidth="1.5"
          />
          <text
            x={node.x}
            y={node.y + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="var(--illu-ink)"
            className="font-heading"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
