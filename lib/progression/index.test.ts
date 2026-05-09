import { describe, it, expect } from "vitest";
import { decideNextWeight, applyDecision, type SetResult } from ".";

const set = (
  actual: number,
  weight = 100,
  range: [number, number] = [8, 12],
  completed = true
): SetResult => ({
  actual_reps: actual,
  weight_lbs: weight,
  target_reps_min: range[0],
  target_reps_max: range[1],
  completed,
});

describe("decideNextWeight", () => {
  it("returns skipped when no sets were completed", () => {
    expect(decideNextWeight([]).rationale).toBe("skipped");
    expect(
      decideNextWeight([set(0, 100, [8, 12], false)]).rationale
    ).toBe("skipped");
  });

  it("increases weight when every completed set hit the top of the range", () => {
    const d = decideNextWeight([set(12), set(12), set(13)]);
    expect(d.rationale).toBe("all_sets_top_of_range");
    expect(d.weightMultiplier).toBeGreaterThan(1);
  });

  it("holds weight when sets land in range without exceeding", () => {
    const d = decideNextWeight([set(10), set(11), set(11)]);
    expect(d.rationale).toBe("in_range_no_change");
    expect(d.weightMultiplier).toBe(1);
  });

  it("holds when one set is barely short", () => {
    const d = decideNextWeight([set(10), set(7)]); // 1 short
    expect(d.rationale).toBe("missed_reps_hold");
    expect(d.weightMultiplier).toBe(1);
  });

  it("reduces when a set is significantly short of the lower bound", () => {
    const d = decideNextWeight([set(10), set(5)]); // 3 short
    expect(d.rationale).toBe("missed_reps_reduce");
    expect(d.weightMultiplier).toBeLessThan(1);
  });
});

describe("applyDecision", () => {
  it("rounds to nearest 5", () => {
    expect(
      applyDecision(135, { weightMultiplier: 1.025, rationale: "all_sets_top_of_range" })
    ).toBe(140); // 135 * 1.025 = 138.4 -> 140
    expect(
      applyDecision(100, { weightMultiplier: 0.95, rationale: "missed_reps_reduce" })
    ).toBe(95);
    expect(
      applyDecision(225, { weightMultiplier: 1, rationale: "in_range_no_change" })
    ).toBe(225);
  });
});
