import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "./logo";

describe("Logo", () => {
  it("shows the wordmark as text, with a red 4, and hides the decorative bulb", () => {
    const { container } = render(<Logo />);

    expect(screen.getByText(/Dev/)).toHaveTextContent("Dev4Innova");
    expect(screen.getByText("4")).toHaveClass("text-primary");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the readable red on dark surfaces", () => {
    render(<Logo variant="inverse" />);
    expect(screen.getByText("4")).toHaveClass("text-primary-on-inverse");
  });

  it("is announced as an image when only the bulb is shown", () => {
    render(<Logo showWordmark={false} />);
    expect(screen.getByRole("img", { name: "Dev4Innova" })).toBeInTheDocument();
  });
});
