import type { components } from "@dev4innova/api-client";

/* AI Gateway back office (EPIC 08): shared types and helpers (client and server). */

export type AIModel = components["schemas"]["ModelOut"];
export type PromptSummary = components["schemas"]["PromptSummary"];
export type Prompt = components["schemas"]["PromptOut"];
export type PromptVersion = components["schemas"]["PromptVersionOut"];
export type UsageReport = components["schemas"]["UsageReport"];

export const PROVIDERS = ["anthropic", "openai", "gemini", "simulated"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROMPT_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** {{variables}} of a prompt template, in order of first appearance. */
export function templateVariables(template: string): string[] {
  const names = [...template.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map((m) => m[1] as string);
  return [...new Set(names)];
}

/** "effort=medium\nfallbacks=default" ⇄ { effort: "medium", fallbacks: "default" }. */
export function parseOptions(text: string): Record<string, string> | null {
  const options: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(line);
    if (!match) return null;
    options[match[1] as string] = (match[2] as string).trim();
  }
  return options;
}

export function formatOptions(options: Record<string, unknown>): string {
  return Object.entries(options)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");
}

export type PlaygroundEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      input_tokens: number;
      output_tokens: number;
      cost_eur: string;
      stop_reason: string;
      served_model: string;
      latency_ms: number;
    }
  | { type: "error"; code: string; message: string };

/**
 * Incremental Server-Sent Events parser: feed it chunks of text, get complete events.
 * Keeps an incomplete trailing event for the next chunk.
 */
export function createSseParser() {
  let buffer = "";
  return (chunk: string): PlaygroundEvent[] => {
    buffer += chunk.replace(/\r\n/g, "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    const events: PlaygroundEvent[] = [];
    for (const block of blocks) {
      let name = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue;
      try {
        const payload = JSON.parse(data.join("\n")) as Record<string, unknown>;
        if (name === "delta" || name === "done" || name === "error") {
          events.push({ type: name, ...payload } as PlaygroundEvent);
        }
      } catch {
        // Malformed event: ignored.
      }
    }
    return events;
  };
}
