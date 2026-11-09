import { describe, expect, it } from "vitest";

import { duration, lessonOrder, normalizeCode, pick, textsFrom } from "./academy";

describe("academy helpers", () => {
  it("reads certificate codes as printed, forgiving case and spaces", () => {
    expect(normalizeCode(" d4i-7kq2-m9xa-p3tz ")).toBe("D4I-7KQ2-M9XA-P3TZ");
    expect(normalizeCode("D4I-7KQ2-M9XA-P3T")).toBeNull();
    expect(normalizeCode("D4I-0KQ2-M9XA-P3TZ")).toBeNull(); // 0 is never used
    expect(normalizeCode("../../admin")).toBeNull();
  });

  it("formats durations", () => {
    const units = { hour: "h", minute: "min" };
    expect(duration(45, units)).toBe("45 min");
    expect(duration(60, units)).toBe("1 h");
    expect(duration(95, units)).toBe("1 h 35");
    expect(duration(125, units)).toBe("2 h 05");
  });

  it("reads a text in both languages from a form", () => {
    const data = new FormData();
    data.set("title_fr", "  Bonjour ");
    data.set("title_en", "Hello");
    expect(textsFrom(data, "title")).toEqual({ fr: "Bonjour", en: "Hello" });
    expect(textsFrom(data, "missing")).toEqual({ fr: "", en: "" });
  });

  it("falls back to French", () => {
    expect(pick({ fr: "Bonjour", en: "" }, "en")).toBe("Bonjour");
    expect(pick({ fr: "Bonjour", en: "Hello" }, "en")).toBe("Hello");
    expect(pick({}, "en")).toBe("");
  });

  it("orders lessons module by module", () => {
    const outline = [{ lessons: [{ id: "a" }, { id: "b" }] }, { lessons: [{ id: "c" }] }];
    expect(lessonOrder({ outline } as never)).toEqual(["a", "b", "c"]);
  });
});
