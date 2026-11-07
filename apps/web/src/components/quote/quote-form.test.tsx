import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { QuoteFormState } from "@/lib/quote/schema";
import { axeViolations } from "@/test/axe";

import { QuoteForm, type QuoteFormLabels } from "./quote-form";

vi.mock("@/i18n/navigation", async () => {
  const { mockI18nNavigation } = await import("@/test/i18n-navigation");
  return mockI18nNavigation(() => "/quote");
});

const labels: QuoteFormLabels = {
  fields: {
    name: "Nom complet",
    email: "Adresse e-mail",
    company: "Organisation",
    phone: "Téléphone",
    service: "Service concerné",
    need: "Votre besoin",
    budget: "Budget indicatif",
    timeline: "Délai souhaité",
    consent: "J'accepte",
  },
  needHelp: "20 caractères minimum.",
  anyService: "Je ne sais pas encore",
  privacyLink: "Politique de confidentialité",
  required: "obligatoire",
  optional: "facultatif",
  submit: "Envoyer la demande",
  sending: "Envoi",
  honeypot: "Ne pas remplir",
  budgets: { lt_10k: "< 10 k€", "10k_30k": "10-30 k€", "30k_100k": "30-100 k€", gt_100k: "> 100 k€", unknown: "Je ne sais pas" },
  timelines: { asap: "Vite", within_3_months: "3 mois", within_6_months: "6 mois", unknown: "Pas défini" },
  success: { title: "Merci", text: "Demande envoyée." },
  errors: {
    summary: "Le formulaire contient des erreurs.",
    name: "Nom invalide.",
    email: "E-mail invalide.",
    company: "Organisation trop longue.",
    phone: "Téléphone trop long.",
    need: "Besoin invalide.",
    consent: "Accord requis.",
    rateLimited: "Trop de demandes.",
    unavailable: "Service indisponible.",
  },
};

const services = [
  { slug: "ai-strategy", title: "Conseil et stratégie IA" },
  { slug: "custom-development", title: "Développement sur mesure" },
];

function renderWith(result: QuoteFormState, initialService?: string) {
  const action = vi.fn(async () => result);
  render(<QuoteForm action={action} labels={labels} services={services} initialService={initialService} />);
  return action;
}

describe("QuoteForm", () => {
  it("preselects the service the visitor came from, and ignores unknown ones", () => {
    renderWith({ status: "success" }, "custom-development");
    expect(screen.getByRole("combobox", { name: "Service concerné" })).toHaveValue("custom-development");
    expect(screen.getByRole("combobox", { name: "Budget indicatif" })).toHaveValue("unknown");
  });

  it("falls back to no service for an unknown slug", () => {
    renderWith({ status: "success" }, "not-a-service");
    expect(screen.getByRole("combobox", { name: "Service concerné" })).toHaveValue("");
  });

  it("shows field errors and keeps the typed values", async () => {
    const user = userEvent.setup();
    renderWith({
      status: "error",
      fieldErrors: ["need"],
      values: {
        name: "Dominique",
        email: "d@example.com",
        company: "",
        phone: "",
        service: "ai-strategy",
        need: "court",
        budget: "gt_100k",
        timeline: "asap",
      },
    });
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));

    expect(await screen.findByText("Le formulaire contient des erreurs.")).toHaveFocus();
    const need = screen.getByRole("textbox", { name: /Votre besoin/ });
    expect(need).toHaveAttribute("aria-invalid", "true");
    expect(need).toHaveValue("court");
    expect(screen.getByRole("combobox", { name: "Budget indicatif" })).toHaveValue("gt_100k");
    expect(screen.getByRole("combobox", { name: "Service concerné" })).toHaveValue("ai-strategy");
  });

  it("confirms the request", async () => {
    const user = userEvent.setup();
    renderWith({ status: "success" });
    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    expect(await screen.findByRole("status")).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    renderWith({ status: "success" });
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
