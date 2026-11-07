import { describe, expect, it } from "vitest";

import { createSseParser, formatOptions, parseOptions, templateVariables } from "./ai";

describe("templateVariables", () => {
  it("lists each variable once, in order", () => {
    expect(templateVariables("Résume {{ texte }} en {{langue}}, puis {{texte}}.")).toEqual(["texte", "langue"]);
    expect(templateVariables("Aucune variable {{ }} {{1x}}")).toEqual([]);
  });
});

describe("provider options", () => {
  it("round-trips name=value lines", () => {
    const options = parseOptions("effort = medium\n\nfallbacks=default\n");
    expect(options).toEqual({ effort: "medium", fallbacks: "default" });
    expect(formatOptions(options!)).toBe("effort=medium\nfallbacks=default");
  });

  it("refuses malformed lines", () => {
    expect(parseOptions("effort medium")).toBeNull();
    expect(parseOptions("=x")).toBeNull();
  });
});

describe("createSseParser", () => {
  it("rebuilds events split across chunks", () => {
    const parse = createSseParser();
    expect(parse('event: delta\ndata: {"text":"Bon')).toEqual([]);
    expect(parse('jour"}\n\nevent: delta\r\ndata: {"text":" le monde"}\n\nevent: do')).toEqual([
      { type: "delta", text: "Bonjour" },
      { type: "delta", text: " le monde" },
    ]);
    expect(parse('ne\ndata: {"input_tokens":12,"output_tokens":5,"cost_eur":"0.0001","stop_reason":"end","served_model":"m","latency_ms":40}\n\n')).toEqual([
      { type: "done", input_tokens: 12, output_tokens: 5, cost_eur: "0.0001", stop_reason: "end", served_model: "m", latency_ms: 40 },
    ]);
  });

  it("ignores unknown and malformed events", () => {
    const parse = createSseParser();
    expect(parse('event: ping\ndata: {}\n\nevent: delta\ndata: {oops\n\nevent: error\ndata: {"code":"x","message":"y"}\n\n')).toEqual([
      { type: "error", code: "x", message: "y" },
    ]);
  });
});
