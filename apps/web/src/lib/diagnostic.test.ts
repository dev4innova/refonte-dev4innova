import { describe, expect, it } from "vitest";

import { radarPoints, unanswered } from "./diagnostic";

describe("unanswered", () => {
  it("lists the questions of a step without an answer, in order", () => {
    expect(unanswered(["a", "b", "c"], { b: "b.1" })).toEqual(["a", "c"]);
    expect(unanswered(["a"], { a: "a.0" })).toEqual([]);
  });
});

describe("radarPoints", () => {
  it("starts at the top and goes clockwise, clamped to 0-100", () => {
    const points = radarPoints([100, 100, 100, 100], 100, 50).split(" ");
    expect(points).toEqual(["100.0,50.0", "150.0,100.0", "100.0,150.0", "50.0,100.0"]);
    // 0 sits at the center; 150 is clamped to the outer ring (pointing down for 2 axes).
    expect(radarPoints([0, 150], 10, 10)).toBe("10.0,10.0 10.0,20.0");
  });
});
