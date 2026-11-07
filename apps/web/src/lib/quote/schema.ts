import { z } from "zod";

/*
 * Quote request form validation (TASK-072), mirroring the API rules
 * (apps/api/app/modules/crm/schemas.py: QuoteRequestCreate). The API stays the authority.
 */
export const QUOTE_BUDGETS = ["lt_10k", "10k_30k", "30k_100k", "gt_100k", "unknown"] as const;
export type QuoteBudget = (typeof QUOTE_BUDGETS)[number];
export const QUOTE_TIMELINES = ["asap", "within_3_months", "within_6_months", "unknown"] as const;
export type QuoteTimeline = (typeof QUOTE_TIMELINES)[number];

export const QUOTE_FIELDS = ["name", "email", "company", "phone", "need", "consent"] as const;
export type QuoteField = (typeof QUOTE_FIELDS)[number];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().pipe(z.email()).pipe(z.string().max(320)),
  company: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  // An unknown service is dropped rather than refused: the list may have changed.
  service: z.string().regex(SLUG).max(120).or(z.literal("")).catch(""),
  need: z.string().trim().min(20).max(5000),
  budget: z.enum(QUOTE_BUDGETS).catch("unknown"),
  timeline: z.enum(QUOTE_TIMELINES).catch("unknown"),
  consent: z.literal("on"),
  website: z.string().max(200),
});

export type QuoteValues = {
  name: string;
  email: string;
  company: string;
  phone: string;
  service: string;
  need: string;
  budget: QuoteBudget;
  timeline: QuoteTimeline;
};

export type QuoteInput = QuoteValues & { website: string };

export type QuoteParseResult =
  | { success: true; data: QuoteInput }
  | { success: false; fieldErrors: QuoteField[] };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const KEYS = [
  "name",
  "email",
  "company",
  "phone",
  "service",
  "need",
  "budget",
  "timeline",
  "consent",
  "website",
] as const;

/** Reads and validates the submitted form. */
export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const result = schema.safeParse(Object.fromEntries(KEYS.map((key) => [key, text(formData, key)])));
  if (result.success) {
    const { name, email, company, phone, service, need, budget, timeline, website } = result.data;
    return {
      success: true,
      data: { name, email, company, phone, service, need, budget, timeline, website },
    };
  }
  const fieldErrors = [
    ...new Set(
      result.error.issues
        .map((issue) => issue.path[0])
        .filter((key): key is QuoteField => QUOTE_FIELDS.includes(key as QuoteField)),
    ),
  ];
  return { success: false, fieldErrors };
}

function oneOf<T extends string>(values: readonly T[], value: string, fallback: T): T {
  return (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Values to put back in the form after an error (never the honeypot). */
export function submittedQuoteValues(formData: FormData): QuoteValues {
  return {
    name: text(formData, "name"),
    email: text(formData, "email"),
    company: text(formData, "company"),
    phone: text(formData, "phone"),
    service: text(formData, "service"),
    need: text(formData, "need"),
    budget: oneOf(QUOTE_BUDGETS, text(formData, "budget"), "unknown"),
    timeline: oneOf(QUOTE_TIMELINES, text(formData, "timeline"), "unknown"),
  };
}

export type QuoteFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      fieldErrors: QuoteField[];
      formError?: "rateLimited" | "unavailable";
      values: QuoteValues;
    };

export const initialQuoteState: QuoteFormState = { status: "idle" };
