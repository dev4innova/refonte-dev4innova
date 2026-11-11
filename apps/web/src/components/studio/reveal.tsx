"use client";

import { useEffect, useRef, useState } from "react";
import type * as React from "react";

type RevealState = "static" | "hidden" | "shown";

export type RevealProps = React.ComponentProps<"div"> & {
  /** Position in a cascade: delays the transition by `--motion-stagger` steps. */
  step?: number;
};

/**
 * Reveals its content when it scrolls into view (opacity and transform only: no layout shift).
 * Content is visible without JavaScript and when it is already on screen; nothing moves when
 * the user prefers reduced motion. The observer disconnects after the first reveal.
 */
export function Reveal({ step = 0, style, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("static");

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already visible at hydration: leave it in place rather than hide it and fade it back in.
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    setState("hidden"); // hidden only once hydrated: the server HTML stays readable
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-slot="reveal"
      data-reveal={state}
      style={step ? { ...style, transitionDelay: `calc(var(--motion-stagger) * ${step})` } : style}
      {...props}
    />
  );
}
