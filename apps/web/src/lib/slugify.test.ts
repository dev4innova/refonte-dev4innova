import { describe, expect, it } from "vitest";

import { slugDraft, slugify } from "./slugify";

describe("slugify", () => {
  it.each([
    ["Stratégie IA : l'essentiel !", "strategie-ia-l-essentiel"],
    ["  Œuvre   collective  ", "oeuvre-collective"],
    ["AI & Data -- 2026", "ai-data-2026"],
    ["Déjà vu", "deja-vu"],
    ["---", ""],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("never ends with a hyphen when truncated", () => {
    expect(slugify("abc def", 4)).toBe("abc");
  });

  it("matches the API slug pattern", () => {
    expect(slugify("Un titre très long, avec 12 mots !")).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

describe("slugDraft", () => {
  it("keeps the trailing hyphen while typing", () => {
    expect(slugDraft("Mon ")).toBe("mon-");
    expect(slugDraft("mon-adr")).toBe("mon-adr");
    expect(slugDraft("-Été")).toBe("ete");
  });
});
