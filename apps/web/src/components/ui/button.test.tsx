import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import { Button } from "./button";

describe("Button", () => {
  it("renders a type=button primary button by default", () => {
    render(<Button>Démarrer</Button>);
    const button = screen.getByRole("button", { name: "Démarrer" });

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-primary");
  });

  it.each([
    ["secondary", "bg-secondary"],
    ["outline", "border"],
    ["ghost", "bg-transparent"],
    ["link", "underline-offset-4"],
    ["inverse", "bg-inverse-foreground"],
  ] as const)("applies the %s variant", (variant, expectedClass) => {
    render(<Button variant={variant}>Action</Button>);
    expect(screen.getByRole("button")).toHaveClass(expectedClass);
  });

  it("calls onClick when activated with the keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Envoyer</Button>);

    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is busy and not clickable while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Envoi
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Envoi" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child with button styles when asChild is set", () => {
    render(
      <Button asChild variant="outline">
        <a href="/contact">Nous contacter</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Nous contacter" });

    expect(link).toHaveAttribute("href", "/contact");
    expect(link).toHaveClass("border");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("merges custom classes over variant classes", () => {
    render(<Button className="w-full">Plein écran</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });

  it("has no accessibility violations, including icon-only buttons with a label", async () => {
    const { container } = render(
      <div>
        <Button>Texte</Button>
        <Button size="icon" aria-label="Ouvrir le menu">
          <svg aria-hidden="true" />
        </Button>
      </div>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
