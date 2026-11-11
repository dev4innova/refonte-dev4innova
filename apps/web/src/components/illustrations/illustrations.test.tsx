import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SOLUTIONS } from "@/config/offer";
import { axeViolations } from "@/test/axe";

import fr from "../../../messages/fr.json";
import { IllustrationPanel } from "./illustration";
import {
  CertificateIllustration,
  DiagnosticReportIllustration,
  PortalIllustration,
  ValueIcon,
} from "./products";
import { SignalToSystem, SignalToSystemCompact } from "./signal-to-system";
import { SolutionIllustration, type SolutionIllustrationLabels } from "./solutions";
import { AcademyPath, LabBoard } from "./worlds";

const L = fr.Illustrations;
const solutionLabels: SolutionIllustrationLabels = {
  ...L.solutions,
  "ai-integration": {
    hub: L.solutions["ai-integration"].hub,
    tools: Object.values(L.solutions["ai-integration"].tools) as SolutionIllustrationLabels["ai-integration"]["tools"],
  },
};

const ILLUSTRATIONS: Array<[string, React.ReactElement, number]> = [
  ["signal to system", <SignalToSystem key="s" labels={L.signalToSystem} />, 8],
  ["signal to system (compact)", <SignalToSystemCompact key="c" />, 2],
  ...SOLUTIONS.map(
    ({ slug }) =>
      [slug, <SolutionIllustration key={slug} slug={slug} labels={solutionLabels} />, 4] as [
        string,
        React.ReactElement,
        number,
      ],
  ),
  ["lab board", <LabBoard key="l" labels={L.lab} />, 6],
  ["academy path", <AcademyPath key="a" labels={L.academy} />, 4],
  ["diagnostic report", <DiagnosticReportIllustration key="d" labels={L.products.diagnostic} />, 3],
  ["client portal", <PortalIllustration key="p" labels={L.products.portal} />, 4],
  ["academy certificate", <CertificateIllustration key="ce" labels={L.products.certificate} />, 3],
  ["value pictogram", <ValueIcon key="v" name="build" />, 1],
];

describe.each(ILLUSTRATIONS)("illustration %s", (_, element, budgetKb) => {
  it("is hidden from assistive technologies and not focusable", async () => {
    const { container } = render(element);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
    }
    expect(await axeViolations(container)).toEqual([]);
  });

  it("uses only the --illu-* variables and currentColor for colors", () => {
    const markup = renderToStaticMarkup(element);
    const colors = [...markup.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(([, value]) => value);
    for (const color of colors) {
      expect(color).toMatch(/^(none|currentColor|var\(--illu-[a-z-]+\))$/);
    }
    expect(markup).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });

  it("stays within its weight budget, with no script or external resource", () => {
    const markup = renderToStaticMarkup(element);
    expect(markup.length / 1024).toBeLessThanOrEqual(budgetKb);
    expect(markup).not.toMatch(/<script|<image|href=/);
  });
});

describe("illustration labels", () => {
  it("come from the translations", () => {
    const markup = renderToStaticMarkup(
      <SolutionIllustration slug="ai-assistants" labels={solutionLabels} />,
    );
    expect(markup).toContain("Ticket créé dans le CRM");
  });

  it("render the six integration tools around the hub", () => {
    const { container } = render(<SolutionIllustration slug="ai-integration" labels={solutionLabels} />);
    expect([...container.querySelectorAll("text")].map((t) => t.textContent)).toEqual([
      "IA",
      "CRM",
      "ERP",
      "Messagerie",
      "Intranet",
      "GED",
      "Agenda",
    ]);
  });
});

describe("compact variants", () => {
  it("swap at 640 px for the signature visual and the lab board", () => {
    const signature = render(<SignalToSystem labels={L.signalToSystem} />).container;
    expect(signature.querySelector("[data-illustration=signal-to-system-compact]")).toHaveClass("sm:hidden");
    expect(signature.querySelector("[data-illustration=signal-to-system]")).toHaveClass("hidden", "sm:block");

    const lab = render(<LabBoard labels={L.lab} />).container;
    expect(lab.querySelector("[data-illustration=lab-board-compact]")).toHaveClass("sm:hidden");
  });

  it("draws the filament once (animation classes, final state under reduced motion in CSS)", () => {
    const { container } = render(<SignalToSystemCompact />);
    expect(container.querySelector(".illu-draw")).toHaveAttribute("pathLength", "1");
  });
});

describe("IllustrationPanel", () => {
  it("reserves the space of the illustration with an aspect ratio", () => {
    const { container } = render(
      <IllustrationPanel ratio="wide">
        <SignalToSystemCompact />
      </IllustrationPanel>,
    );
    expect(container.firstChild).toHaveClass("aspect-video", "lg:aspect-[21/8]");
  });
});
