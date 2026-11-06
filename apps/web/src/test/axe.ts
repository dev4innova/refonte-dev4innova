import axe from "axe-core";

/**
 * Runs axe-core on a rendered container and returns readable violations.
 * Color contrast is checked separately (jsdom does not compute styles; see tokens.test.ts
 * and the Playwright accessibility suite).
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
  );
}
