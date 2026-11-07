import { z } from "zod";

/*
 * Contact form validation, mirroring the API rules (apps/api/app/modules/contact/schemas.py).
 * The API stays the authority; this gives immediate, translated feedback.
 */
export const CONTACT_TOPICS = ["project", "training", "partnership", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_FIELDS = ["name", "email", "company", "message", "consent"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().pipe(z.email()).pipe(z.string().max(320)),
  company: z.string().trim().max(160),
  topic: z.enum(CONTACT_TOPICS).catch("other"),
  message: z.string().trim().min(20).max(5000),
  consent: z.literal("on"),
  website: z.string().max(200),
});

export type ContactValues = {
  name: string;
  email: string;
  company: string;
  topic: ContactTopic;
  message: string;
};

export type ContactInput = ContactValues & { website: string };

export type ParseResult =
  | { success: true; data: ContactInput }
  | { success: false; fieldErrors: ContactField[] };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Reads and validates the submitted form. Unknown topics fall back to "other". */
export function parseContactForm(formData: FormData): ParseResult {
  const result = schema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    company: text(formData, "company"),
    topic: text(formData, "topic"),
    message: text(formData, "message"),
    consent: text(formData, "consent"),
    website: text(formData, "website"),
  });
  if (result.success) {
    const { name, email, company, topic, message, website } = result.data;
    return { success: true, data: { name, email, company, topic, message, website } };
  }
  const fieldErrors = [
    ...new Set(
      result.error.issues
        .map((issue) => issue.path[0])
        .filter((key): key is ContactField => CONTACT_FIELDS.includes(key as ContactField)),
    ),
  ];
  return { success: false, fieldErrors };
}

/** Values to put back in the form after an error (never the honeypot). */
export function submittedValues(formData: FormData): ContactValues {
  const topic = text(formData, "topic");
  return {
    name: text(formData, "name"),
    email: text(formData, "email"),
    company: text(formData, "company"),
    topic: (CONTACT_TOPICS as readonly string[]).includes(topic) ? (topic as ContactTopic) : "project",
    message: text(formData, "message"),
  };
}
