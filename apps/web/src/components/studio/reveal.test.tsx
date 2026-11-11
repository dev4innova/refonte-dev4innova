import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "./reveal";

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;

let callback: Callback | undefined;
const disconnect = vi.fn();

function mockEnvironment({ reduced, top }: { reduced: boolean; top: number }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: Callback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);
}

describe("Reveal", () => {
  beforeEach(() => {
    callback = undefined;
    disconnect.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("hides content below the fold, then shows it once and disconnects", () => {
    mockEnvironment({ reduced: false, top: 5000 });
    render(<Reveal>Contenu</Reveal>);
    const element = screen.getByText("Contenu");
    expect(element).toHaveAttribute("data-reveal", "hidden");

    act(() => callback?.([{ isIntersecting: true }]));
    expect(element).toHaveAttribute("data-reveal", "shown");
    expect(disconnect).toHaveBeenCalled();
  });

  it("leaves content already on screen in place", () => {
    mockEnvironment({ reduced: false, top: 10 });
    render(<Reveal>Contenu</Reveal>);
    expect(screen.getByText("Contenu")).toHaveAttribute("data-reveal", "static");
    expect(callback).toBeUndefined();
  });

  it("does nothing when the user prefers reduced motion", () => {
    mockEnvironment({ reduced: true, top: 5000 });
    render(<Reveal>Contenu</Reveal>);
    expect(screen.getByText("Contenu")).toHaveAttribute("data-reveal", "static");
    expect(callback).toBeUndefined();
  });

  it("staggers a cascade with the motion token", () => {
    mockEnvironment({ reduced: true, top: 0 });
    render(<Reveal step={2}>Contenu</Reveal>);
    expect(screen.getByText("Contenu").style.transitionDelay).toBe("calc(var(--motion-stagger) * 2)");
  });
});
