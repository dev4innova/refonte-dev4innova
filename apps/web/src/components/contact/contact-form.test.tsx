import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ContactFormState } from "@/lib/contact/state";
import { axeViolations } from "@/test/axe";

import { ContactForm, type ContactFormLabels } from "./contact-form";

vi.mock("@/i18n/navigation", async () => {
  const { mockI18nNavigation } = await import("@/test/i18n-navigation");
  return mockI18nNavigation(() => "/contact");
});

const labels: ContactFormLabels = {
  fields: {
    name: "Nom complet",
    email: "Adresse e-mail",
    company: "Organisation",
    topic: "Sujet",
    message: "Votre message",
    consent: "J'accepte",
  },
  messageHelp: "20 caractères minimum.",
  privacyLink: "Politique de confidentialité",
  required: "obligatoire",
  optional: "facultatif",
  submit: "Envoyer",
  sending: "Envoi en cours",
  honeypot: "Ne pas remplir",
  topics: { project: "Projet", training: "Formation", partnership: "Partenariat", other: "Autre" },
  success: { title: "Merci", text: "Message envoyé." },
  errors: {
    summary: "Le formulaire contient des erreurs.",
    name: "Nom invalide.",
    email: "E-mail invalide.",
    company: "Organisation trop longue.",
    message: "Message invalide.",
    consent: "Accord requis.",
    rateLimited: "Trop de messages.",
    unavailable: "Service indisponible.",
  },
};

const values = { name: "Ca", email: "bad", company: "", topic: "training" as const, message: "court" };

function renderWith(result: ContactFormState) {
  const action = vi.fn(async () => result);
  render(<ContactForm action={action} labels={labels} />);
  return action;
}

describe("ContactForm", () => {
  it("renders labelled fields, the privacy link and the hidden honeypot", () => {
    renderWith({ status: "success" });

    expect(screen.getByRole("textbox", { name: /Nom complet/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /Adresse e-mail/ })).toHaveAttribute("type", "email");
    expect(screen.getByRole("combobox", { name: "Sujet" })).toHaveValue("project");
    expect(screen.getByRole("checkbox", { name: /J'accepte/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute(
      "href",
      "/fr/privacy",
    );
    // The honeypot is not exposed to people using assistive technologies.
    expect(screen.queryByRole("textbox", { name: "Ne pas remplir" })).not.toBeInTheDocument();
  });

  it("shows field errors, keeps the typed values and focuses the summary", async () => {
    const user = userEvent.setup();
    renderWith({ status: "error", fieldErrors: ["email", "consent"], values });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    const summary = await screen.findByText("Le formulaire contient des erreurs.");
    expect(summary).toHaveAttribute("role", "alert");
    expect(summary).toHaveFocus();
    const email = screen.getByRole("textbox", { name: /Adresse e-mail/ });
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("E-mail invalide.");
    expect(email).toHaveValue("bad");
    // The topic select is checked in a real browser (e2e/contact.spec.ts): jsdom does not
    // implement form reset for <select> like browsers do.
  });

  it("shows a global message when the service is unavailable", async () => {
    const user = userEvent.setup();
    renderWith({ status: "error", fieldErrors: [], formError: "unavailable", values });

    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByText("Service indisponible.")).toBeInTheDocument();
  });

  it("replaces the form by a confirmation after success", async () => {
    const user = userEvent.setup();
    const action = renderWith({ status: "success" });

    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(action).toHaveBeenCalledOnce();
    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent("Merci");
    expect(confirmation).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Envoyer" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    renderWith({ status: "success" });
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
