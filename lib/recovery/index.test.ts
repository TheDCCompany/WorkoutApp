import { describe, it, expect } from "vitest";
import {
  computeRecoveryScore,
  bandFor,
  buildRecoveryStates,
  recommendMuscleGroups,
  expandOverride,
  daysSince,
} from ".";
import type { MuscleGroup } from "@/types/domain";

const NOW = new Date("2026-05-09T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("daysSince", () => {
  it("returns 0 when training was today", () => {
    expect(daysSince(NOW, NOW)).toBe(0);
  });
  it("returns large number when null", () => {
    expect(daysSince(NOW, null)).toBeGreaterThan(100);
  });
  it("rounds down to whole days", () => {
    expect(daysSince(NOW, daysAgo(3))).toBe(3);
  });
});

describe("computeRecoveryScore", () => {
  it("hits 100 once enough days have passed and no fatigue", () => {
    expect(
      computeRecoveryScore(
        {
          muscle_group: "Chest" as MuscleGroup,
          last_trained_at: daysAgo(5),
          recent_hard_sets: 0,
          average_fatigue_score: 0,
        },
        NOW
      )
    ).toBe(100);
  });

  it("subtracts fatigue penalty", () => {
    // 4 days * 25 = 100; minus (10*3 + 6) = 36 => 64
    expect(
      computeRecoveryScore(
        {
          muscle_group: "Chest" as MuscleGroup,
          last_trained_at: daysAgo(4),
          recent_hard_sets: 10,
          average_fatigue_score: 6,
        },
        NOW
      )
    ).toBe(64);
  });

  it("clamps below zero", () => {
    expect(
      computeRecoveryScore(
        {
          muscle_group: "Chest" as MuscleGroup,
          last_trained_at: daysAgo(0),
          recent_hard_sets: 30,
          average_fatigue_score: 9,
        },
        NOW
      )
    ).toBe(0);
  });
});

describe("bandFor", () => {
  it("classifies the recovery bands per the spec", () => {
    expect(bandFor(100).band).toBe("fully_recovered");
    expect(bandFor(89).band).toBe("good");
    expect(bandFor(50).band).toBe("light");
    expect(bandFor(30).band).toBe("avoid_direct");
    expect(bandFor(0).band).toBe("rest");
  });
});

describe("buildRecoveryStates", () => {
  it("includes every direct muscle group, defaulting untrained ones to high recovery", () => {
    const states = buildRecoveryStates(
      [
        {
          muscle_group: "Chest",
          last_trained_at: daysAgo(0),
          recent_hard_sets: 12,
          average_fatigue_score: 7,
        },
      ],
      NOW
    );
    const chest = states.find((s) => s.muscle_group === "Chest")!;
    const back = states.find((s) => s.muscle_group === "Back")!;
    expect(chest.recovery_score).toBeLessThan(20);
    expect(back.recovery_score).toBe(100);
    // 11 direct groups expected
    expect(states).toHaveLength(11);
  });
});

describe("recommendMuscleGroups", () => {
  it("recommends a pair of recovered groups when one's available", () => {
    const states = buildRecoveryStates(
      [
        {
          muscle_group: "Chest",
          last_trained_at: daysAgo(1),
          recent_hard_sets: 16,
          average_fatigue_score: 7,
        },
        {
          muscle_group: "Triceps",
          last_trained_at: daysAgo(1),
          recent_hard_sets: 8,
          average_fatigue_score: 5,
        },
        {
          muscle_group: "Back",
          last_trained_at: daysAgo(4),
          recent_hard_sets: 0,
          average_fatigue_score: 0,
        },
        {
          muscle_group: "Biceps",
          last_trained_at: daysAgo(3),
          recent_hard_sets: 0,
          average_fatigue_score: 0,
        },
      ],
      NOW
    );
    const rec = recommendMuscleGroups(states);
    expect(rec.groups).toContain("Back");
    expect(rec.groups).toContain("Biceps");
    expect(rec.reason).toMatch(/days of rest/);
  });

  it("returns a single group if no recovered partner exists", () => {
    const states = buildRecoveryStates(
      [
        {
          muscle_group: "Back",
          last_trained_at: daysAgo(4),
          recent_hard_sets: 0,
          average_fatigue_score: 0,
        },
        {
          muscle_group: "Biceps",
          last_trained_at: daysAgo(0),
          recent_hard_sets: 12,
          average_fatigue_score: 8,
        },
      ],
      NOW
    );
    const rec = recommendMuscleGroups(states);
    expect(rec.groups).toEqual(["Back"]);
  });
});

describe("expandOverride", () => {
  it("expands Upper Body to chest/back/shoulders/arms", () => {
    expect(expandOverride("Upper Body")).toEqual([
      "Chest",
      "Back",
      "Shoulders",
      "Biceps",
      "Triceps",
    ]);
  });
  it("expands Lower Body to legs", () => {
    expect(expandOverride("Lower Body")).toEqual([
      "Quads",
      "Hamstrings",
      "Glutes",
      "Calves",
    ]);
  });
  it("returns single direct group as-is", () => {
    expect(expandOverride("Chest")).toEqual(["Chest"]);
  });
});
