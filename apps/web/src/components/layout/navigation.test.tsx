import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import { isActivePath } from "./nav-links";
import { SiteHeader } from "./site-header";
import type { NavItem, NavLabels } from "./types";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const items: NavItem[] = [
  { href: "/solutions", label: "Solutions" },
  { href: "/services", label: "Services" },
];
const labels: NavLabels = {
  navigation: "Navigation principale",
  openMenu: "Ouvrir le menu",
  closeMenu: "Fermer le menu",
  menuTitle: "Menu",
  home: "DEV4INNOVA, accueil",
};
const cta: NavItem = { href: "/contact", label: "Nous contacter" };

function renderHeader() {
  return render(<SiteHeader items={items} labels={labels} cta={cta} />);
}

describe("isActivePath", () => {
  it.each([
    ["/", "/", true],
    ["/solutions", "/", false],
    ["/solutions", "/solutions", true],
    ["/solutions/ia-generative", "/solutions", true],
    ["/solutions-old", "/solutions", false],
  ])("pathname %s, href %s → %s", (current, href, expected) => {
    expect(isActivePath(current, href)).toBe(expected);
  });
});

describe("SiteHeader", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("renders the logo link, the main navigation and the call to action", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: labels.home })).toHaveAttribute("href", "/");
    const nav = screen.getByRole("navigation", { name: labels.navigation });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Solutions",
      "Services",
    ]);
    expect(screen.getByRole("link", { name: "Nous contacter" })).toHaveAttribute("href", "/contact");
  });

  it("marks the current page with aria-current", () => {
    pathname.current = "/services/audit";
    renderHeader();
    const nav = screen.getByRole("navigation", { name: labels.navigation });

    expect(within(nav).getByRole("link", { name: "Services" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Solutions" })).not.toHaveAttribute("aria-current");
  });

  it("opens and closes the mobile menu with the keyboard", async () => {
    const user = userEvent.setup();
    renderHeader();
    const trigger = screen.getByRole("button", { name: labels.openMenu });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: labels.menuTitle });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("link", { name: "Solutions" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Nous contacter" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes the mobile menu when a link is chosen", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: labels.openMenu }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("link", { name: "Services" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the mobile menu with its close button", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: labels.openMenu }));
    await user.click(screen.getByRole("button", { name: labels.closeMenu }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the language switcher slot", () => {
    render(
      <SiteHeader items={items} labels={labels} localeSwitcher={<button type="button">EN</button>} />,
    );
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  });

  it("has no accessibility violations, menu closed and open", async () => {
    const user = userEvent.setup();
    const { container } = renderHeader();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: labels.openMenu }));
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
