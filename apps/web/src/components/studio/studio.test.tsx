import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { axeViolations } from "@/test/axe";

import { BentoCell, BentoGrid } from "./bento-grid";
import { Eyebrow } from "./eyebrow";
import { MethodLoop, MethodTimeline } from "./method-timeline";
import { Kbd, StatusDot, Tag } from "./micro";
import { ProductFrame } from "./product-frame";
import { SectionHeading } from "./section-heading";

describe("Eyebrow", () => {
  it("shows the index before the label", () => {
    render(<Eyebrow index="01">Solutions</Eyebrow>);
    const eyebrow = screen.getByText("Solutions");
    expect(eyebrow).toHaveTextContent("01Solutions");
    expect(eyebrow.querySelector("[data-slot=eyebrow-index]")).toHaveTextContent("01");
    expect(eyebrow.tagName).toBe("P");
  });

  it("can be the heading of a section", () => {
    render(<Eyebrow as="h2">Nos engagements</Eyebrow>);
    expect(screen.getByRole("heading", { level: 2, name: "Nos engagements" })).toBeInTheDocument();
  });
});

describe("SectionHeading", () => {
  it("renders a labelled h2 with eyebrow, lead and actions", async () => {
    const { container } = render(
      <section aria-labelledby="solutions-title">
        <SectionHeading
          id="solutions-title"
          index="02"
          eyebrow="Solutions"
          title="Cinq briques éprouvées"
          lead="Adaptées à votre contexte métier."
          actions={<a href="/fr/solutions">Toutes les solutions</a>}
        />
      </section>,
    );
    expect(screen.getByRole("region", { name: "Cinq briques éprouvées" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute("id", "solutions-title");
    expect(screen.getByText("Adaptées à votre contexte métier.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Toutes les solutions" })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("omits the optional parts", () => {
    const { container } = render(<SectionHeading id="t" title="Titre" as="h3" />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(container.querySelector("[data-slot=eyebrow]")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });
});

describe("BentoGrid", () => {
  function Grid() {
    return (
      <BentoGrid>
        <BentoCell size="lg">
          <h3>
            <a href="/fr/solutions/a" data-stretched>
              Assistants IA
            </a>
          </h3>
          <p>Texte</p>
        </BentoCell>
        <BentoCell size="md" surface="tint">
          <h3>Automatisation</h3>
        </BentoCell>
        <BentoCell size="wide" surface="inverse">
          <h3>Intégration</h3>
        </BentoCell>
      </BentoGrid>
    );
  }

  it("is a list whose order is the reading order", async () => {
    const { container } = render(<Grid />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Assistants IATexte",
      "Automatisation",
      "Intégration",
    ]);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("maps sizes to column spans and marks dark cells", () => {
    render(<Grid />);
    const [large, medium, wide] = screen.getAllByRole("listitem") as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(large).toHaveClass("lg:col-span-7");
    expect(medium).toHaveClass("lg:col-span-5", "bg-tint-subtle");
    expect(wide).toHaveClass("lg:col-span-12");
    expect(wide).toHaveAttribute("data-variant", "inverse");
    expect(medium).not.toHaveAttribute("data-variant");
  });

  it("keeps a single focusable link per clickable cell", () => {
    render(<Grid />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("ProductFrame", () => {
  it("is a figure whose caption always states demonstration data", async () => {
    const { container } = render(
      <ProductFrame
        title="Diagnostic IA"
        demoLabel="Démonstration"
        caption="Rapport de maturité généré par le diagnostic."
        image={{ src: "/captures/diagnostic.webp", alt: "Radar de maturité IA", width: 1600, height: 1000 }}
      />,
    );
    const figure = screen.getByRole("figure");
    expect(figure.querySelector("figcaption")).toHaveTextContent(
      "DémonstrationRapport de maturité généré par le diagnostic.",
    );
    expect(screen.getByRole("img", { name: "Radar de maturité IA" })).toBeInTheDocument();
    expect(screen.getByText("Diagnostic IA")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("shows its children while no screenshot is available", () => {
    render(
      <ProductFrame title="Portail client" demoLabel="Démonstration">
        <p>Capture à venir</p>
      </ProductFrame>,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Capture à venir")).toBeInTheDocument();
  });
});

describe("MethodTimeline", () => {
  const steps = [
    { key: "explore", title: "Explorer", text: "Ateliers.", deliverable: "Livrable : cas d'usage" },
    { key: "prototype", title: "Prototyper", text: "Preuve de concept." },
    { key: "industrialize", title: "Industrialiser", text: "Solution robuste." },
    { key: "improve", title: "Améliorer", text: "Suivi des usages." },
  ];

  it("is an ordered list of level-3 steps with decorative numbers", async () => {
    const { container } = render(<MethodTimeline steps={steps} />);
    expect(container.querySelector("ol")).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Explorer",
      "Prototyper",
      "Industrialiser",
      "Améliorer",
    ]);
    expect(screen.getByText("04")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Livrable : cas d'usage")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("draws a decorative loop hidden from assistive technologies", () => {
    const { container } = render(<MethodLoop />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelectorAll("circle")).toHaveLength(4);
  });
});

describe("micro elements", () => {
  it("renders tags, keys and decorative status dots", async () => {
    const { container } = render(
      <p>
        <StatusDot status="live" /> <Tag tone="tint">FastAPI</Tag> <Kbd>⌘</Kbd>
      </p>,
    );
    expect(screen.getByText("FastAPI")).toHaveClass("bg-tint");
    expect(container.querySelector("[data-slot=status-dot]")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("kbd")).toHaveTextContent("⌘");
    expect(await axeViolations(container)).toEqual([]);
  });
});
