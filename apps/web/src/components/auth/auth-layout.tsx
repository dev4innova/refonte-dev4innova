import { BookOpenCheck, FolderKanban, Sparkles } from "lucide-react";
import type * as React from "react";

import { AccountHub, type AccountHubLabels } from "@/components/illustrations/account-hub";
import { Eyebrow } from "@/components/studio/eyebrow";

export type AuthLayoutProps = {
  panel: {
    eyebrow: string;
    title: string;
    points: { projects: string; academy: string; ai: string };
  };
  illustration: AccountHubLabels;
  /** The form column (its h1, form and links). */
  children: React.ReactNode;
};

const POINTS = [
  { key: "projects", icon: FolderKanban },
  { key: "academy", icon: BookOpenCheck },
  { key: "ai", icon: Sparkles },
] as const;

/**
 * Sign-in and sign-up: a graphite panel on the left (what the account opens, with an animated
 * illustration) and the form on the right. From 1024 px; below, the form alone. The panel has
 * no heading: the form title stays the page's only h1.
 */
export function AuthLayout({ panel, illustration, children }: AuthLayoutProps) {
  return (
    <div className="grid lg:min-h-[calc(100dvh-var(--header-height))] lg:grid-cols-2">
      <div
        data-variant="inverse"
        data-header-overlay=""
        className="pattern-blueprint hidden flex-col justify-between gap-10 bg-inverse px-gutter py-14 text-inverse-foreground lg:flex xl:px-16"
      >
        <div className="flex max-w-lg flex-col gap-5">
          <Eyebrow>{panel.eyebrow}</Eyebrow>
          <p className="font-heading text-display-md font-semibold text-balance">{panel.title}</p>
          <ul className="flex list-none flex-col gap-3 p-0">
            {POINTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-3 text-inverse-muted-foreground">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-inverse-border bg-inverse-elevated text-primary-on-inverse">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                {panel.points[key]}
              </li>
            ))}
          </ul>
        </div>
        <AccountHub labels={illustration} className="w-full max-w-md self-center" />
      </div>
      <div className="flex items-center justify-center px-gutter py-12 sm:py-16">
        <div className="flex w-full max-w-md flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
