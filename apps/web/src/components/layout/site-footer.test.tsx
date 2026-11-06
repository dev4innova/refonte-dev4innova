import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import { SiteFooter, type SiteFooterProps } from "./site-footer";

vi.mock("@/i18n/navigation", async () => {
  const { mockI18nNavigation } = await import("@/test/i18n-navigation");
  return mockI18nNavigation(() => "/");
});

const props: SiteFooterProps = {
  tagline: "L'intégrateur de solutions IA",
  description: "Description",
  navigationLabel: "Plan du site",
  columns: [
    { title: "Offre", links: [{ href: "/solutions", label: "Solutions" }] },
    { title: "Entreprise", links: [{ href: "/contact", label: "Contact" }] },
  ],
  legalLinks: [{ href: "/legal-notice", label: "Mentions légales" }],
  copyright: "© DEV4INNOVA. Tous droits réservés.",
};

describe("SiteFooter", () => {
  it("renders the brand block, the link columns and the legal bar", () => {
    render(<SiteFooter {...props} />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("L'intégrateur de solutions IA")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Plan du site" });
    expect(within(nav).getByRole("heading", { level: 2, name: "Offre" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/fr/contact");
    expect(screen.getByRole("link", { name: "Mentions légales" })).toHaveAttribute(
      "href",
      "/fr/legal-notice",
    );
    expect(screen.getByText(props.copyright)).toBeInTheDocument();
  });

  it("uses the dark inverse surface", () => {
    render(<SiteFooter {...props} />);
    expect(screen.getByRole("contentinfo")).toHaveClass("bg-inverse");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SiteFooter {...props} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
