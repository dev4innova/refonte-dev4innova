import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import { LocaleSwitcher } from "./locale-switcher";

vi.mock("next-intl", () => ({ useLocale: () => "fr" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "fr" }) }));
vi.mock("@/i18n/navigation", async () => {
  const { mockI18nNavigation } = await import("@/test/i18n-navigation");
  return mockI18nNavigation(() => "/about");
});

const options = [
  { locale: "fr", name: "Français" },
  { locale: "en", name: "English" },
] as const;

function renderSwitcher() {
  return render(<LocaleSwitcher label="Langue" options={[...options]} />);
}

describe("LocaleSwitcher", () => {
  it("links to the current page in every locale", () => {
    renderSwitcher();
    const nav = screen.getByRole("navigation", { name: "Langue" });

    expect(within(nav).getByRole("link", { name: "Français" })).toHaveAttribute("href", "/fr/about");
    expect(within(nav).getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/about");
  });

  it("marks the current locale and declares each link's language", () => {
    renderSwitcher();
    const french = screen.getByRole("link", { name: "Français" });
    const english = screen.getByRole("link", { name: "English" });

    expect(french).toHaveAttribute("aria-current", "true");
    expect(english).not.toHaveAttribute("aria-current");
    expect(english).toHaveAttribute("lang", "en");
    expect(english).toHaveAttribute("hreflang", "en");
  });

  it("shows short codes visually and full names to assistive technologies", () => {
    renderSwitcher();
    const english = screen.getByRole("link", { name: "English" });

    expect(english).toHaveTextContent("EN");
    expect(within(english).getByText("English")).toHaveClass("sr-only");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderSwitcher();
    expect(await axeViolations(container)).toEqual([]);
  });
});
