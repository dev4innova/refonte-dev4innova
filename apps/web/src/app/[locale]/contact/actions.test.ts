import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ serverApi: () => ({ POST: post }) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));

import { initialContactState } from "@/lib/contact/state";

import { submitContact } from "./actions";

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values = {
    name: "Camille Durand",
    email: "camille@example.com",
    company: "",
    topic: "project",
    message: "Nous souhaitons automatiser le traitement de nos factures.",
    consent: "on",
    website: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("submitContact", () => {
  beforeEach(() => post.mockReset());

  it("sends a valid request to the API with the visitor's address", async () => {
    post.mockResolvedValue({ response: new Response(null, { status: 202 }), data: { id: "x" } });

    const state = await submitContact("en", initialContactState, form());

    expect(state).toEqual({ status: "success" });
    const [path, options] = post.mock.calls[0]!;
    expect(path).toBe("/api/v1/contact-requests");
    expect(options.body).toMatchObject({ locale: "en", consent: true, company: null, topic: "project" });
    expect(options.headers).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it("does not call the API when the form is invalid", async () => {
    const state = await submitContact("fr", initialContactState, form({ email: "nope", consent: "" }));

    expect(post).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "error", fieldErrors: ["email", "consent"] });
    expect(state.status === "error" && state.values.email).toBe("nope");
  });

  it("reports rate limiting", async () => {
    post.mockResolvedValue({ response: new Response(null, { status: 429 }), error: {} });
    const state = await submitContact("fr", initialContactState, form());
    expect(state).toMatchObject({ status: "error", formError: "rateLimited" });
  });

  it("maps API validation errors to fields", async () => {
    post.mockResolvedValue({
      response: new Response(null, { status: 422 }),
      error: { error: { details: { errors: [{ loc: ["body", "email"] }, { loc: ["body", "x"] }] } } },
    });
    const state = await submitContact("fr", initialContactState, form());
    expect(state).toMatchObject({ status: "error", fieldErrors: ["email"] });
  });

  it("reports the service as unavailable on network or server errors", async () => {
    post.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await submitContact("fr", initialContactState, form())).toMatchObject({
      formError: "unavailable",
    });

    post.mockResolvedValueOnce({ response: new Response(null, { status: 500 }), error: {} });
    expect(await submitContact("fr", initialContactState, form())).toMatchObject({
      formError: "unavailable",
    });
  });
});
