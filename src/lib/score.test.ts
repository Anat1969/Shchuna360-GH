import { describe, expect, it } from "vitest";
import { ALL_METRICS } from "../data/chapters";
import { overall, pathToTarget } from "./score";

describe("score", () => {
  it("has the 44 ILGBC metrics", () => expect(ALL_METRICS).toHaveLength(44));

  it("full marks give 100% at every stage", () => {
    const full = Object.fromEntries(ALL_METRICS.map((m) => [m.id, m.maxScore]));
    for (const s of [1, 2, 3]) expect(overall(full, s).pct).toBe(100);
  });

  it("ignores metrics outside the stage", () => {
    const only4 = { 4: 2 }; // metric 4 applies to stage A only
    expect(overall(only4, 1).got).toBe(2);
    expect(overall(only4, 2).got).toBe(0);
  });

  it("path reaches the target exactly", () => {
    const p = pathToTarget({}, 2, 55);
    const after = Object.fromEntries(p.steps.map((s) => [s.id, s.to]));
    expect(overall(after, 2).pct).toBeGreaterThanOrEqual(55);
    expect(p.steps.reduce((n, s) => n + s.to - s.from, 0)).toBe(p.need);
  });
});
