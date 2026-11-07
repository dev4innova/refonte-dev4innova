import type { ContactField, ContactValues } from "./schema";

export type ContactFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      fieldErrors: ContactField[];
      formError?: "rateLimited" | "unavailable";
      values: ContactValues;
    };

export const initialContactState: ContactFormState = { status: "idle" };
