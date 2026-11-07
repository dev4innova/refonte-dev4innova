import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

import { DocumentEditor } from "./document-editor";

const saveDocument = vi.fn();
const replace = vi.fn();

vi.mock("@/app/[locale]/admin/actions", () => ({
  saveDocument: (...args: unknown[]) => saveDocument(...args),
  setPublished: vi.fn(),
  deleteDocument: vi.fn(),
  previewMarkdown: vi.fn(),
}));

vi.mock("@/i18n/navigation", async () => {
  const { mockI18nNavigation } = await import("@/test/i18n-navigation");
  return { ...mockI18nNavigation(() => "/admin"), useRouter: () => ({ replace, push: vi.fn() }) };
});

function renderEditor() {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ Admin: messages.Admin }}>
      <DocumentEditor type="article" initial={null} media={[]} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("DocumentEditor", () => {
  it("derives the slug from the title until the slug is edited", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByLabelText(/^Titre(?! SEO)/), "L'IA générative");
    const slug = screen.getByLabelText(/Adresse \(slug\)/);
    expect(slug).toHaveValue("l-ia-generative");

    await user.clear(slug);
    await user.type(slug, "mon-adresse");
    await user.type(screen.getByLabelText(/^Titre(?! SEO)/), " en 2026");
    expect(slug).toHaveValue("mon-adresse");
  });

  it("opens the edit page once a new document is saved", async () => {
    saveDocument.mockResolvedValue({ ok: true, data: { id: "doc-1" } });
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByLabelText(/^Titre(?! SEO)/), "Premier article");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(saveDocument).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ type: "article", coverMediaId: null }),
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: "/admin/content/[type]/[id]",
      params: { type: "article", id: "doc-1" },
      query: { saved: "1" },
    });
  });

  it("explains a slug conflict", async () => {
    saveDocument.mockResolvedValue({ ok: false, error: "slug" });
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByLabelText(/^Titre(?! SEO)/), "Doublon");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(messages.Admin.editor.errors.slug)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
