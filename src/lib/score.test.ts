import { describe, expect, it } from "vitest";
import { ALL_METRICS, GRADES, getGrade, toPoints } from "../data/chapters";
import { overall, pathToTarget } from "./score";

describe("score", () => {
  it("has the 44 sub-topics of שכונה 360° v2.0 with their official maxima", () => {
    expect(ALL_METRICS).toHaveLength(44);
    // metric 41 at 3 (its own section) makes the stated 120
    expect(ALL_METRICS.reduce((s, m) => s + m.maxScore, 0)).toBe(120);
    expect(ALL_METRICS.find((m) => m.id === 41)?.maxScore).toBe(3);
    expect(ALL_METRICS.find((m) => m.id === 18)?.maxScore).toBe(7);
    expect(ALL_METRICS.find((m) => m.id === 29)?.maxScore).toBe(6);
  });

  it("full marks give 100% and 120 points", () => {
    const full = Object.fromEntries(ALL_METRICS.map((m) => [m.id, m.maxScore]));
    expect(overall(full).pct).toBe(100);
    expect(overall(full).points).toBe(120);
  });

  it("metrics marked not relevant leave the denominator", () => {
    const only7 = { 7: 2 };
    expect(overall(only7, { 7: true }).got).toBe(0);
    expect(overall({}, { 7: true }).max).toBe(118);
  });

  it("official rating bands, normalised to 120", () => {
    expect(getGrade((55 / 120) * 100).label).toBe("ארד");
    expect(getGrade((85 / 120) * 100).label).toBe("פלטינום");
    expect(getGrade(40).label).toBe("מתחת לסף");
    expect(toPoints(50)).toBe(60);
    expect(GRADES.map((g) => g.label)).toEqual(["פלטינום", "זהב", "כסף", "ארד", "מתחת לסף"]);
  });

  it("path reaches the target exactly", () => {
    const p = pathToTarget({}, {}, 55);
    const after = Object.fromEntries(p.steps.map((s) => [s.id, s.to]));
    expect(overall(after).pct).toBeGreaterThanOrEqual(55);
    expect(p.steps.reduce((n, s) => n + s.to - s.from, 0)).toBe(p.need);
  });
});
