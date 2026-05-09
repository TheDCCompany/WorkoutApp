import { describe, it, expect } from "vitest";
import { recommendWeight, roundToNearest5, pickIntensityPct } from "./recommend";

describe("roundToNearest5", () => {
  it("rounds down when closer to lower 5", () => {
    expect(roundToNearest5(101)).toBe(100);
    expect(roundToNearest5(102.4)).toBe(100);
  });
  it("rounds up at the midpoint", () => {
    expect(roundToNearest5(102.5)).toBe(105);
    expect(roundToNearest5(103)).toBe(105);
  });
});

describe("pickIntensityPct", () => {
  it("uses ~80% for 6-8 rep top", () => {
    expect(pickIntensityPct(8)).toBeCloseTo(0.8);
  });
  it("uses ~70% for 8-12 rep top", () => {
    expect(pickIntensityPct(12)).toBeCloseTo(0.7);
  });
  it("uses ~60% for 12-15 rep top", () => {
    expect(pickIntensityPct(15)).toBeCloseTo(0.6);
  });
  it("uses ~52.5% for 15-20 rep top", () => {
    expect(pickIntensityPct(20)).toBeCloseTo(0.525);
  });
});

describe("recommendWeight", () => {
  it("uses 1RM and intensity band, rounded to nearest 5", () => {
    expect(
      recommendWeight({ oneRepMaxLbs: 200, repRange: { min: 6, max: 8 } })
    ).toBe(160); // 200 * 0.8 = 160
    expect(
      recommendWeight({ oneRepMaxLbs: 200, repRange: { min: 8, max: 12 } })
    ).toBe(140); // 200 * 0.7 = 140
    expect(
      recommendWeight({ oneRepMaxLbs: 100, repRange: { min: 12, max: 15 } })
    ).toBe(60); // 100 * 0.6 = 60
  });

  it("falls back to last logged weight when no 1RM", () => {
    expect(
      recommendWeight({
        lastLoggedWeightLbs: 137,
        repRange: { min: 8, max: 12 },
      })
    ).toBe(135);
  });

  it("returns null when no 1RM and no history", () => {
    expect(recommendWeight({ repRange: { min: 8, max: 12 } })).toBeNull();
    expect(
      recommendWeight({
        oneRepMaxLbs: null,
        lastLoggedWeightLbs: null,
        repRange: { min: 8, max: 12 },
      })
    ).toBeNull();
  });

  it("treats zero or negative 1RM as no max", () => {
    expect(
      recommendWeight({
        oneRepMaxLbs: 0,
        lastLoggedWeightLbs: 95,
        repRange: { min: 8, max: 12 },
      })
    ).toBe(95);
  });
});
