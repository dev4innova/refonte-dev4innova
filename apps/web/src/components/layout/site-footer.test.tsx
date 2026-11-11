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
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("bg-inverse-deep");
    expect(footer).toHaveAttribute("data-variant", "inverse");
  });

  it("recalls the two ways to get in touch, each card being a single link", () => {
    render(
      <SiteFooter
        {...props}
        routesTitle="Un projet, une question ?"
        routes={[
          { href: "/contact", label: "Parler de votre projet", text: "Un premier échange.", action: "Nous contacter" },
          { href: "/diagnostic", label: "Commencer par le diagnostic", text: "Quelques minutes.", action: "Faire le diagnostic" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Un projet, une question ?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Parler de votre projet" })).toHaveAttribute("href", "/fr/contact");
    expect(screen.getByRole("link", { name: "Commencer par le diagnostic" })).toHaveAttribute(
      "href",
      "/fr/diagnostic",
    );
    // The call to action text is decorative: it does not add a second link.
    expect(screen.queryByRole("link", { name: /Nous contacter/ })).toBeNull();
  });

  it("shows the large wordmark to sighted users only", () => {
    const { container } = render(<SiteFooter {...props} />);
    const wordmark = container.querySelector("[data-slot=footer-wordmark]");
    expect(wordmark).toHaveTextContent("Dev4Innova");
    expect(wordmark?.closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SiteFooter {...props} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
