import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import messages from "../../../messages/fr.json";

import { Comments } from "./comments";

const comment = (body: string, fromStaff: boolean) => ({
  id: body,
  author: { id: "u", display_name: fromStaff ? "Pam" : "Mia", email: null, is_staff: fromStaff },
  from_staff: fromStaff,
  body,
  created_at: "2026-11-08T10:00:00Z",
});

function renderComments(load = vi.fn(), add = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ Portal: messages.Portal }} timeZone="Europe/Paris">
      <Comments name="Maquettes" count={1} load={load} add={add} />
    </NextIntlClientProvider>,
  );
}

describe("Comments", () => {
  it("loads the thread on demand and tells the team apart", async () => {
    const user = userEvent.setup();
    const load = vi.fn().mockResolvedValue({ ok: true, data: [comment("Validé côté RH", true)] });
    const { container } = renderComments(load);
    expect(load).not.toHaveBeenCalled();
    const toggle = screen.getByRole("button", { name: "Voir le commentaire (1)" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const thread = await screen.findByRole("region", { name: "Commentaires sur « Maquettes »" });
    expect(thread).toHaveTextContent("Pam · Équipe DEV4INNOVA");
    expect(thread).toHaveTextContent("Validé côté RH");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("adds a comment and shows the new thread", async () => {
    const user = userEvent.setup();
    const load = vi.fn().mockResolvedValue({ ok: true, data: [] });
    const add = vi.fn().mockResolvedValue({ ok: true, data: [comment("Plus de couleurs ?", false)] });
    renderComments(load, add);
    await user.click(screen.getByRole("button", { name: /commentaire/ }));
    await screen.findByText("Aucun commentaire pour l'instant.");
    await user.type(screen.getByLabelText("Votre commentaire"), "Plus de couleurs ?");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(add).toHaveBeenCalledWith("Plus de couleurs ?");
    expect(await screen.findByText("Plus de couleurs ?", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByLabelText("Votre commentaire")).toHaveValue("");
  });

  it("explains a refusal", async () => {
    const user = userEvent.setup();
    renderComments(vi.fn().mockResolvedValue({ ok: false, error: "notFound" }));
    await user.click(screen.getByRole("button", { name: /commentaire/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cet élément n'existe plus");
  });
});
