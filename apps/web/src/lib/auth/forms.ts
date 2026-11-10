/*
 * Validation of the account forms (ADR-0019), mirroring the API rules
 * (apps/api/app/modules/identity/auth.py). The API stays the authority.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const AUTH_FIELDS = ["name", "email", "current", "password", "confirm"] as const;
export type AuthField = (typeof AUTH_FIELDS)[number];

export type AuthFieldError = "required" | "invalidEmail" | "tooShort" | "tooLong" | "mismatch" | "sameAsEmail" | "taken" | "wrong" | "unknownAccount";
export type AuthFormError = "invalidCredentials" | "rateLimited" | "unavailable" | "forbidden";

export type AuthFormState =
  | { status: "idle" }
  | { status: "success"; temporaryPassword?: string; email?: string }
  | {
      status: "error";
      errors: Partial<Record<AuthField, AuthFieldError>>;
      formError?: AuthFormError;
      /** Values to put back in the form (never a password). */
      values: { name?: string; email?: string };
    };

export const initialAuthState: AuthFormState = { status: "idle" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, key: AuthField): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export type AuthValues = Record<AuthField, string>;

/** Reads the submitted fields: names and emails are trimmed, passwords never. */
export function readAuthForm(formData: FormData): AuthValues {
  return {
    name: text(formData, "name").trim(),
    email: text(formData, "email").trim().toLowerCase(),
    current: text(formData, "current"),
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  };
}

function checkEmail(email: string): AuthFieldError | undefined {
  if (!email) return "required";
  return EMAIL.test(email) && email.length <= 320 ? undefined : "invalidEmail";
}

function checkNewPassword(values: AuthValues): Partial<Record<AuthField, AuthFieldError>> {
  const errors: Partial<Record<AuthField, AuthFieldError>> = {};
  if (!values.password) errors.password = "required";
  else if (values.password.length < PASSWORD_MIN_LENGTH) errors.password = "tooShort";
  else if (values.password.length > PASSWORD_MAX_LENGTH) errors.password = "tooLong";
  else if (values.email && values.password.trim().toLowerCase() === values.email) errors.password = "sameAsEmail";
  if (!errors.password && values.confirm !== values.password) errors.confirm = "mismatch";
  return errors;
}

function compact(errors: Partial<Record<AuthField, AuthFieldError | undefined>>) {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Partial<Record<AuthField, AuthFieldError>>;
}

export function validateSignIn(values: AuthValues) {
  return compact({ email: checkEmail(values.email), password: values.password ? undefined : "required" });
}

export function validateSignUp(values: AuthValues) {
  return compact({ name: values.name ? undefined : "required", email: checkEmail(values.email), ...checkNewPassword(values) });
}

export function validatePasswordChange(values: AuthValues, email: string) {
  return compact({ current: values.current ? undefined : "required", ...checkNewPassword({ ...values, email }) });
}

export function validatePasswordReset(values: AuthValues) {
  return compact({ email: checkEmail(values.email) });
}
