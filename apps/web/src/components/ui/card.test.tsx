import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { axeViolations } from "@/test/axe";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

function Example(props: React.ComponentProps<typeof Card>) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Intégration IA</CardTitle>
        <CardDescription>Des assistants connectés à vos outils.</CardDescription>
      </CardHeader>
      <CardContent>Contenu</CardContent>
      <CardFooter>
        <a href="/solutions">En savoir plus</a>
      </CardFooter>
    </Card>
  );
}

describe("Card", () => {
  it("renders a level-3 title by default", () => {
    render(<Example />);
    expect(screen.getByRole("heading", { level: 3, name: "Intégration IA" })).toBeInTheDocument();
  });

  it("lets the caller choose the heading level", () => {
    render(<CardTitle as="h2">Titre</CardTitle>);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it.each([
    ["default", "bg-card"],
    ["elevated", "shadow-elevated"],
    ["inverse", "bg-inverse"],
  ] as const)("applies the %s variant", (variant, expectedClass) => {
    const { container } = render(<Example variant={variant} />);
    const card = container.querySelector("[data-slot=card]");

    expect(card).toHaveClass(expectedClass);
    expect(card).toHaveAttribute("data-variant", variant);
  });

  it("adds hover feedback when interactive", () => {
    const { container } = render(<Example interactive />);
    expect(container.querySelector("[data-slot=card]")).toHaveClass("hover:-translate-y-1");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Example variant="inverse" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
