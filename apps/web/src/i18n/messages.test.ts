import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

import { routing } from "./routing";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") entries.set(path, value);
    else for (const [k, v] of flatten(value, path)) entries.set(k, v);
  }
  return entries;
}

const dictionaries: Record<string, Map<string, string>> = { fr: flatten(fr), en: flatten(en) };

describe("translation dictionaries", () => {
  it("exist for every configured locale", () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...routing.locales].sort());
  });

  it("have exactly the same keys in FR and EN", () => {
    const frKeys = [...dictionaries.fr!.keys()];
    const enKeys = [...dictionaries.en!.keys()];

    expect(enKeys.filter((k) => !dictionaries.fr!.has(k))).toEqual([]);
    expect(frKeys.filter((k) => !dictionaries.en!.has(k))).toEqual([]);
  });

  it.each(Object.entries(dictionaries))("%s has no empty message", (_, messages) => {
    expect([...messages].filter(([, value]) => value.trim() === "").map(([k]) => k)).toEqual([]);
  });

  it("uses the same ICU placeholders in both languages", () => {
    // `{name}` or `{name, plural, ...}`; plural branch texts (`=0 {no item}`) are not variables.
    // ICU-quoted text ('{{name}}') is literal, not a variable.
    const placeholders = (s: string) =>
      [...s.replace(/'[{}][^']*'/g, "").matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort();
    const mismatches = [...dictionaries.fr!].filter(
      ([key, value]) =>
        JSON.stringify(placeholders(value)) !==
        JSON.stringify(placeholders(dictionaries.en!.get(key) ?? "")),
    );
    expect(mismatches.map(([k]) => k)).toEqual([]);
  });

  it.each([
    ["fr", fr],
    ["en", en],
  ] as const)("%s messages are all valid ICU and format without error", (locale, messages) => {
    const failures: string[] = [];
    const t = createTranslator({
      locale,
      messages,
      onError: (error) => failures.push(error.message),
    });
    for (const [key, message] of dictionaries[locale]!) {
      // Every variable gets the number 1: valid for text, numbers and plurals.
      const names = message.replace(/'[{}][^']*'/g, "").matchAll(/\{(\w+)\s*[,}]/g);
      const values = Object.fromEntries([...names].map((m) => [m[1], 1]));
      t(key as Parameters<typeof t>[0], values);
    }
    expect(failures).toEqual([]);
  });
});
