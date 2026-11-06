import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Reads src/styles/tokens.css (the single source of truth) and checks that every
 * foreground/background pairing used by the components meets WCAG 2.1 AA.
 */
const css = readFileSync(path.resolve(import.meta.dirname, "tokens.css"), "utf8");

const declarations = new Map(
  [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value!.trim()]),
);

function resolve(token: string): string {
  const value = declarations.get(token);
  if (!value) throw new Error(`Unknown token ${token}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? resolve(reference[1]!) : value;
}

function luminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = channels as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(resolve(foreground)), luminance(resolve(background))].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const TEXT = 4.5; // normal text
const UI = 3; // large text, icons, borders of controls

describe("design tokens", () => {
  it("keeps the brand identity colors", () => {
    expect(resolve("--primary")).toBe("#d90000");
    expect(resolve("--foreground")).toBe("#171717");
    expect(resolve("--background")).toBe("#f4f4f4");
  });

  it.each([
    ["--foreground", "--background"],
    ["--foreground", "--card"],
    ["--primary-foreground", "--primary"],
    ["--primary-foreground", "--primary-hover"],
    ["--primary", "--card"],
    ["--primary", "--background"],
    ["--secondary-foreground", "--secondary"],
    ["--muted-foreground", "--card"],
    ["--muted-foreground", "--background"],
    ["--muted-foreground", "--muted"],
    ["--accent-foreground", "--accent"],
    ["--destructive", "--card"],
    ["--destructive-foreground", "--destructive"],
    ["--inverse-foreground", "--inverse"],
    ["--inverse-muted-foreground", "--inverse"],
    ["--primary-on-inverse", "--inverse"],
  ])("text %s on %s meets AA (4.5:1)", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each([
    ["--input", "--card"],
    ["--input", "--background"],
    ["--ring", "--card"],
    ["--ring", "--background"],
    ["--primary", "--inverse"],
  ])("UI element %s on %s meets AA non-text contrast (3:1)", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(UI);
  });

  it("documents that brand red is not readable as small text on black", () => {
    expect(contrast("--primary", "--inverse")).toBeLessThan(TEXT);
  });
});
