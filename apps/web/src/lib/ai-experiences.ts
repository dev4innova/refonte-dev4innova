import type { components } from "@dev4innova/api-client";

/* AI experiences (EPIC 09): shared types and constants (client and server). */

export type AISessionSummary = components["schemas"]["SessionSummary"];
export type AISessionDetail = components["schemas"]["SessionOut"];
export type AIChatMessage = components["schemas"]["MessageOut"];
export type OrganizationAIUsage = components["schemas"]["OrganizationAIUsage"];

export const KINDS = ["assistant", "document", "content"] as const;
export type Kind = (typeof KINDS)[number];
export const CONTENT_FORMATS = ["blog_post", "linkedin_post", "newsletter", "product_description", "email"] as const;
export const TONES = ["professional", "friendly", "inspiring", "didactic"] as const;
export const LENGTHS = ["short", "medium", "long"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export type Tone = (typeof TONES)[number];
export type Length = (typeof LENGTHS)[number];

export const MESSAGE_MAX_CHARS = 8000;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";
