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
  Sparkles,
} from "lucide-react";

/*
 * Structure of the offer. Texts live in messages/{fr,en}.json under Solutions.items.<slug>
 * and Services.items.<slug>; slugs are shared by both languages. The CMS (EPIC 06) will
 * take over this content.
 */
export const SOLUTIONS = [
  { slug: "ai-assistants", icon: Bot },
  { slug: "document-automation", icon: FileStack },
  { slug: "data-intelligence", icon: LineChart },
  { slug: "generative-content", icon: Sparkles },
  { slug: "ai-integration", icon: Plug },
] as const satisfies readonly { slug: string; icon: LucideIcon }[];

export const SERVICES = [
  { slug: "ai-strategy", icon: Compass },
  { slug: "custom-development", icon: Hammer },
  { slug: "integration-deployment", icon: Rocket },
  { slug: "training-support", icon: GraduationCap },
  { slug: "run-and-improve", icon: ServerCog },
] as const satisfies readonly { slug: string; icon: LucideIcon }[];

export type SolutionSlug = (typeof SOLUTIONS)[number]["slug"];
export type ServiceSlug = (typeof SERVICES)[number]["slug"];

export const LAB_ICON = BrainCircuit;

export function isSolutionSlug(value: string): value is SolutionSlug {
  return SOLUTIONS.some((s) => s.slug === value);
}

export function isServiceSlug(value: string): value is ServiceSlug {
  return SERVICES.some((s) => s.slug === value);
}
