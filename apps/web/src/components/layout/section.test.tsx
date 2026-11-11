import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Section } from "./section";

describe("Section", () => {
  it("wraps its content in a container with the default surface and spacing", () => {
    const { container } = render(<Section aria-label="Bloc">Contenu</Section>);
    const section = screen.getByRole("region", { name: "Bloc" });
    expect(section).toHaveClass("py-section", "bg-background");
    expect(section).toHaveAttribute("data-variant", "default");
    expect(container.querySelector("[data-slot=container]")).toHaveTextContent("Contenu");
  });

  it.each([
    ["tint", "bg-tint"],
    ["inverse", "bg-inverse"],
  ] as const)("applies the %s surface", (variant, expectedClass) => {
    render(<Section variant={variant} aria-label="Bloc" />);
    const section = screen.getByRole("region");
    expect(section).toHaveClass(expectedClass);
    expect(section).toHaveAttribute("data-variant", variant);
  });

  it("offers a tight spacing and a decorative top rule", () => {
    const { container } = render(<Section spacing="tight" rule aria-label="Bloc" />);
    expect(screen.getByRole("region")).toHaveClass("py-section-tight", "relative");
    expect(container.querySelector("[data-slot=section-rule]")).toHaveAttribute("aria-hidden", "true");
  });
});
