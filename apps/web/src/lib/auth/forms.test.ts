import { describe, expect, it } from "vitest";

import { readAuthForm, validatePasswordChange, validatePasswordReset, validateSignIn, validateSignUp } from "./forms";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const STRONG = "correct horse battery";

describe("account forms", () => {
  it("normalizes the email but never touches a password", () => {
    const values = readAuthForm(form({ email: "  Alice@Example.COM ", password: "  spaced  " }));
    expect(values.email).toBe("alice@example.com");
    expect(values.password).toBe("  spaced  ");
  });

  it("checks sign-in fields", () => {
    expect(validateSignIn(readAuthForm(form({})))).toEqual({ email: "required", password: "required" });
    expect(validateSignIn(readAuthForm(form({ email: "not-an-email", password: "x" })))).toEqual({ email: "invalidEmail" });
    expect(validateSignIn(readAuthForm(form({ email: "a@b.fr", password: "x" })))).toEqual({});
  });

  it("checks sign-up passwords like the API", () => {
    const base = { name: "Alice", email: "alice@example.com" };
    expect(validateSignUp(readAuthForm(form({ ...base, password: "short", confirm: "short" })))).toEqual({ password: "tooShort" });
    expect(validateSignUp(readAuthForm(form({ ...base, password: "x".repeat(129), confirm: "x" })))).toEqual({ password: "tooLong" });
    expect(validateSignUp(readAuthForm(form({ ...base, password: "Alice@Example.com", confirm: "Alice@Example.com" })))).toEqual({
      password: "sameAsEmail",
    });
    expect(validateSignUp(readAuthForm(form({ ...base, password: STRONG, confirm: "other" })))).toEqual({ confirm: "mismatch" });
    expect(validateSignUp(readAuthForm(form({ ...base, password: STRONG, confirm: STRONG })))).toEqual({});
    expect(validateSignUp(readAuthForm(form({ email: base.email, password: STRONG, confirm: STRONG })))).toEqual({ name: "required" });
  });

  it("checks password changes and resets", () => {
    expect(validatePasswordChange(readAuthForm(form({ password: STRONG, confirm: STRONG })), "a@b.fr")).toEqual({ current: "required" });
    expect(validatePasswordChange(readAuthForm(form({ current: "old", password: "a@b.fr".padEnd(12, " "), confirm: "x" })), "a@b.fr")).toEqual({
      password: "sameAsEmail",
    });
    expect(validatePasswordReset(readAuthForm(form({ email: "" })))).toEqual({ email: "required" });
  });
});
