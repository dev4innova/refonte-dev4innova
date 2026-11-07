import {
  Bot,
  BrainCircuit,
  Compass,
  FileStack,
  GraduationCap,
  Hammer,
  LineChart,
  type LucideIcon,
  Plug,
  Rocket,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

/*
 * Solutions: structure in code, texts in messages/{fr,en}.json (Solutions.items.<slug>).
 * Services, articles, projects and pages come from the CMS (EPIC 06).
 */
export const SOLUTIONS = [
  { slug: "ai-assistants", icon: Bot },
  { slug: "document-automation", icon: FileStack },
  { slug: "data-intelligence", icon: LineChart },
  { slug: "generative-content", icon: Sparkles },
  { slug: "ai-integration", icon: Plug },
] as const satisfies readonly { slug: string; icon: LucideIcon }[];

export type SolutionSlug = (typeof SOLUTIONS)[number]["slug"];

export function isSolutionSlug(value: string): value is SolutionSlug {
  return SOLUTIONS.some((s) => s.slug === value);
}

/** Icons an editor can pick for a service (CMS attribute `icon`). */
export const CONTENT_ICONS = {
  compass: Compass,
  hammer: Hammer,
  rocket: Rocket,
  "graduation-cap": GraduationCap,
  "server-cog": ServerCog,
  bot: Bot,
  sparkles: Sparkles,
  "brain-circuit": BrainCircuit,
  "shield-check": ShieldCheck,
  users: Users,
} as const satisfies Record<string, LucideIcon>;

export type ContentIconName = keyof typeof CONTENT_ICONS;

export function contentIcon(name: string | undefined): LucideIcon {
  return (name && name in CONTENT_ICONS ? CONTENT_ICONS[name as ContentIconName] : Sparkles);
}
