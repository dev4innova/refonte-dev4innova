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
  it("keeps the Creative Tech Studio palette", () => {
    expect(resolve("--primary")).toBe("#e11927");
    expect(resolve("--primary-ink")).toBe("#c8101e");
    expect(resolve("--foreground")).toBe("#141417");
    expect(resolve("--background")).toBe("#f7f7f5");
    expect(resolve("--inverse")).toBe("#141417");
    expect(resolve("--tint")).toBe("#dce5f4");
  });

  it.each([
    ["--foreground", "--background"],
    ["--foreground", "--card"],
    ["--primary-foreground", "--primary"],
    ["--primary-foreground", "--primary-hover"],
    ["--primary-ink", "--card"],
    ["--primary-ink", "--background"],
    ["--primary-ink-hover", "--background"],
    ["--secondary-foreground", "--secondary"],
    ["--secondary-foreground", "--secondary-hover"],
    ["--muted-foreground", "--card"],
    ["--muted-foreground", "--background"],
    ["--muted-foreground", "--muted"],
    ["--muted-foreground", "--tint"],
    ["--accent-foreground", "--accent"],
    ["--destructive", "--card"],
    ["--destructive-foreground", "--destructive"],
    ["--success", "--card"],
    ["--warning", "--card"],
    ["--tint-foreground", "--tint"],
    ["--tint-foreground", "--tint-subtle"],
    ["--inverse-foreground", "--inverse"],
    ["--inverse-foreground", "--inverse-elevated"],
    ["--inverse-foreground", "--inverse-deep"],
    ["--inverse-muted-foreground", "--inverse"],
    ["--inverse-muted-foreground", "--inverse-deep"],
    ["--primary-on-inverse", "--inverse"],
  ])("text %s on %s meets AA (4.5:1)", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each([
    ["--input", "--card"],
    ["--input", "--background"],
    ["--ring", "--card"],
    ["--ring", "--background"],
    ["--primary", "--background"],
    ["--primary", "--card"],
    ["--primary-on-inverse", "--inverse"],
    ["--primary-on-inverse", "--inverse-elevated"],
    ["--primary", "--inverse"],
  ])("UI element or large text %s on %s meets AA non-text contrast (3:1)", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(UI);
  });

  it("documents that the signature red is not small text on light surfaces", () => {
    // #e11927 on ivory is 4.48:1: small red text uses --primary-ink.
    expect(contrast("--primary", "--background")).toBeLessThan(TEXT);
    expect(contrast("--primary", "--inverse")).toBeLessThan(TEXT);
  });
});
