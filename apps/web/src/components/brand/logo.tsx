import type * as React from "react";

import { cn } from "@/lib/utils";

/*
 * DEV4INNOVA logo, vectorized from the historical logo: a red and black light bulb
 * holding the D4I monogram, and the "Dev4Innova" wordmark with a red "4" and a red
 * underline. Static copies: public/brand/dev4innova-mark.svg and src/app/icon.svg.
 * Brand colors are kept literal here on purpose: the logo must not follow theme tokens.
 */

const BRAND_NAME = "Dev4Innova";

export function LogoMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 100 128"
      aria-hidden="true"
      focusable="false"
      className={cn("h-10 w-auto shrink-0", className)}
      {...props}
    >
      <path
        d="M36 94c0-9-4-15-11-23C17 62 12 53 12 42a38 38 0 1 1 76 0c0 11-5 20-13 29-7 8-11 14-11 23z"
        fill="#fff"
        stroke="#7a0505"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M36 94c0-9-4-15-11-23C17 62 12 53 12 42a38 38 0 1 1 76 0c0 11-5 20-13 29-7 8-11 14-11 23z"
        fill="none"
        stroke="#141417"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M45 94V70c-8-4-9-13-2-14 3 0 6 3 7 7 1-4 4-7 7-7 7 1 6 10-2 14v24"
        fill="none"
        stroke="#e11927"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 23h13c14 0 21 8 21 20s-7 20-21 20H27zm7 6v28h6c9 0 14-5 14-14s-5-14-14-14z"
        fill="#141417"
        fillRule="evenodd"
      />
      <path d="M61 15h7v18h4v6h-4v9h-7v-9H48v-5zm0 9-6 9h6z" fill="#e11927" fillRule="evenodd" />
      <path d="M58 51h17v5h-5v20h5v5H58v-5h5V56h-5z" fill="#141417" />
      <g fill="#141417" stroke="#7a0505" strokeWidth="1.6">
        <rect x="33" y="97" width="34" height="6" rx="3" />
        <rect x="33" y="105" width="34" height="6" rx="3" />
        <rect x="35" y="113" width="30" height="6" rx="3" />
      </g>
      <path d="M42 121h16c-2 4-5 5-8 5s-6-1-8-5z" fill="#141417" />
    </svg>
  );
}

export type LogoProps = {
  /** `inverse` for dark surfaces (footer, dark sections). */
  variant?: "default" | "inverse";
  /** Hide the wordmark to show the bulb only (compact spaces). */
  showWordmark?: boolean;
  /** Slightly smaller below 360 px (site header on the narrowest phones). */
  responsive?: boolean;
  className?: string;
};

export function Logo({
  variant = "default",
  showWordmark = true,
  responsive = false,
  className,
}: LogoProps) {
  return (
    <span
      data-slot="logo"
      className={cn("inline-flex items-center gap-2.5", responsive && "max-[22.5rem]:gap-2", className)}
      {...(showWordmark ? {} : { role: "img", "aria-label": BRAND_NAME })}
    >
      <LogoMark className={responsive ? "max-[22.5rem]:h-8" : undefined} />
      {showWordmark ? (
        <span
          className={cn(
            "font-heading text-xl font-bold tracking-tight",
            responsive && "max-[22.5rem]:text-lg",
            "border-b-[3px] pb-0.5 leading-none",
            variant === "inverse"
              ? "border-primary text-inverse-foreground"
              : "border-primary text-foreground",
          )}
        >
          Dev
          <span className={variant === "inverse" ? "text-primary-on-inverse" : "text-primary"}>4</span>
          Innova
        </span>
      ) : null}
    </span>
  );
}
