import { describe, it, expect } from "vitest";
import {
  filterByWorkoutMode,
  filterByUserPool,
  filterByMuscleGroups,
  exerciseCountFor,
  generateWorkout,
  selectExercises,
} from ".";
import type { Exercise, MuscleGroup } from "@/types/domain";

const NOW = new Date("2026-05-09T12:00:00Z");

function ex(overrides: Partial<Exercise> & { id: string }): Exercise {
  return {
    id: overrides.id,
    exercise_name: overrides.exercise_name ?? `Exercise ${overrides.id}`,
    slug: overrides.slug ?? overrides.id.toLowerCase(),
    primary_muscle_group: overrides.primary_muscle_group ?? "Chest",
    secondary_muscle_groups: overrides.secondary_muscle_groups ?? [],
    movement_pattern: overrides.movement_pattern ?? "Press",
    equipment_type: overrides.equipment_type ?? "Dumbbell",
    bodyweight_compatible: overrides.bodyweight_compatible ?? false,
    workout_mode: overrides.workout_mode ?? "standard",
    compound_or_isolation: overrides.compound_or_isolation ?? "Compound",
    unilateral: overrides.unilateral ?? false,
    hypertrophy_tier: overrides.hypertrophy_tier ?? 1,
    fatigue_score_1_10: overrides.fatigue_score_1_10 ?? 5,
    axial_fatigue_1_10: overrides.axial_fatigue_1_10 ?? 1,
    systemic_fatigue_1_10: overrides.systemic_fatigue_1_10 ?? 4,
    setup_complexity_1_10: overrides.setup_complexity_1_10 ?? 2,
    stability_requirement_1_10: overrides.stability_requirement_1_10 ?? 4,
    progression_type: overrides.progression_type ?? "Weight",
    recommended_rep_min: overrides.recommended_rep_min ?? 8,
    recommended_rep_max: overrides.recommended_rep_max ?? 12,
    default_sets_min: overrides.default_sets_min ?? 3,
    default_sets_max: overrides.default_sets_max ?? 4,
    default_rest_seconds: overrides.default_rest_seconds ?? 90,
    estimated_time_minutes: overrides.estimated_time_minutes ?? 8,
    beginner_friendly: overrides.beginner_friendly ?? true,
    max_test_eligible: overrides.max_test_eligible ?? true,
    superset_friendly: overrides.superset_friendly ?? true,
    superset_pairing_preference: overrides.superset_pairing_preference ?? [],
    avoid_superset_with: overrides.avoid_superset_with ?? [],
    stimulus_to_fatigue_rating: overrides.stimulus_to_fatigue_rating ?? "High",
    programming_notes: overrides.programming_notes ?? null,
  };
}

describe("filterByWorkoutMode", () => {
  it("standard accepts standard and both", () => {
    const list = [
      ex({ id: "S", workout_mode: "standard" }),
      ex({ id: "B", workout_mode: "bodyweight" }),
      ex({ id: "X", workout_mode: "both" }),
    ];
    const out = filterByWorkoutMode(list, "standard").map((e) => e.id);
    expect(out).toEqual(["S", "X"]);
  });

  it("bodyweight accepts bodyweight and both", () => {
    const list = [
      ex({ id: "S", workout_mode: "standard" }),
      ex({ id: "B", workout_mode: "bodyweight" }),
      ex({ id: "X", workout_mode: "both" }),
    ];
    const out = filterByWorkoutMode(list, "bodyweight").map((e) => e.id);
    expect(out).toEqual(["B", "X"]);
  });
});

describe("filterByUserPool", () => {
  it("includes only exercises whose ids are in the pool", () => {
    const list = [
      ex({ id: "A" }),
      ex({ id: "B" }),
      ex({ id: "C" }),
    ];
    const pool = new Set(["A", "C"]);
    expect(filterByUserPool(list, pool).map((e) => e.id)).toEqual(["A", "C"]);
  });
});

describe("filterByMuscleGroups", () => {
  it("filters to exercises whose primary group matches", () => {
    const list = [
      ex({ id: "C", primary_muscle_group: "Chest" }),
      ex({ id: "B", primary_muscle_group: "Back" }),
      ex({ id: "Q", primary_muscle_group: "Quads" }),
    ];
    expect(filterByMuscleGroups(list, ["Chest", "Back"]).map((e) => e.id)).toEqual([
      "C",
      "B",
    ]);
  });

  it("treats Full Body as 'any compound'", () => {
    const list = [
      ex({ id: "I", compound_or_isolation: "Isolation" }),
      ex({ id: "C", compound_or_isolation: "Compound" }),
    ];
    expect(filterByMuscleGroups(list, ["Full Body"]).map((e) => e.id)).toEqual([
      "C",
    ]);
  });
});

describe("exerciseCountFor", () => {
  it("matches the spec ranges", () => {
    expect(exerciseCountFor(20)).toEqual({ min: 2, max: 3 });
    expect(exerciseCountFor(30)).toEqual({ min: 3, max: 4 });
    expect(exerciseCountFor(45)).toEqual({ min: 4, max: 6 });
    expect(exerciseCountFor(60)).toEqual({ min: 5, max: 8 });
    expect(exerciseCountFor(75)).toEqual({ min: 6, max: 10 });
  });
});

describe("selectExercises", () => {
  it("respects the time budget and count range", () => {
    const list = Array.from({ length: 8 }, (_, i) =>
      ex({
        id: `E${i}`,
        estimated_time_minutes: 8,
        primary_muscle_group: "Chest",
      })
    );
    const out = selectExercises(
      list,
      ["Chest" as MuscleGroup],
      20,
      { min: 2, max: 3 },
      { lastPerformedByExerciseId: new Map(), now: NOW }
    );
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.length).toBeLessThanOrEqual(3);
    const total = out.reduce((s, e) => s + e.estimated_time_minutes, 0);
    expect(total).toBeLessThanOrEqual(20);
  });

  it("prefers higher tier (Tier 1 over Tier 4) for the same group", () => {
    const list = [
      ex({ id: "T4", hypertrophy_tier: 4, exercise_name: "AAA" }),
      ex({ id: "T1", hypertrophy_tier: 1, exercise_name: "ZZZ" }),
    ];
    const out = selectExercises(
      list,
      ["Chest" as MuscleGroup],
      30,
      { min: 1, max: 1 },
      { lastPerformedByExerciseId: new Map(), now: NOW }
    );
    expect(out[0].id).toBe("T1");
  });

  it("spreads across multiple target groups", () => {
    const list = [
      ex({ id: "C1", primary_muscle_group: "Chest" }),
      ex({ id: "C2", primary_muscle_group: "Chest" }),
      ex({ id: "C3", primary_muscle_group: "Chest" }),
      ex({ id: "B1", primary_muscle_group: "Back" }),
      ex({ id: "B2", primary_muscle_group: "Back" }),
    ];
    const out = selectExercises(
      list,
      ["Chest" as MuscleGroup, "Back" as MuscleGroup],
      45,
      { min: 4, max: 4 },
      { lastPerformedByExerciseId: new Map(), now: NOW }
    );
    const groups = out.map((e) => e.primary_muscle_group);
    expect(groups.filter((g) => g === "Chest").length).toBeGreaterThanOrEqual(1);
    expect(groups.filter((g) => g === "Back").length).toBeGreaterThanOrEqual(1);
  });
});

describe("generateWorkout end-to-end", () => {
  it("produces a workout that fits the budget and uses selected mode", () => {
    const pool: Exercise[] = [
      ex({ id: "C1", primary_muscle_group: "Chest", hypertrophy_tier: 1 }),
      ex({ id: "C2", primary_muscle_group: "Chest", hypertrophy_tier: 2 }),
      ex({ id: "T1", primary_muscle_group: "Triceps", hypertrophy_tier: 1 }),
      ex({
        id: "BW",
        primary_muscle_group: "Chest",
        workout_mode: "bodyweight",
      }),
    ];
    const out = generateWorkout({
      pool,
      targetGroups: ["Chest", "Triceps"],
      reason: "test",
      workoutMode: "standard",
      availableMinutes: 30,
      oneRepMaxLbsByExerciseId: new Map([["C1", 200]]),
      lastLoggedWeightLbsByExerciseId: new Map(),
      lastPerformedByExerciseId: new Map(),
      now: NOW,
    });
    expect(out.exercises.length).toBeGreaterThanOrEqual(3);
    expect(out.exercises.length).toBeLessThanOrEqual(4);
    // The bodyweight exercise must NOT appear when in standard mode (it
    // had workout_mode "bodyweight", not "both").
    const ids = out.exercises.map((e) => e.exercise.id);
    expect(ids).not.toContain("BW");
    // C1 has 1RM=200 → mid pct of 0.7 (8-12 range) → 140
    const c1 = out.exercises.find((e) => e.exercise.id === "C1");
    expect(c1?.sets[0].recommended_weight_lbs).toBe(140);
  });

  it("respects an explicit muscle group override (ignoring the pool's broader options)", () => {
    const pool: Exercise[] = [
      ex({ id: "Q1", primary_muscle_group: "Quads", hypertrophy_tier: 1 }),
      ex({ id: "C1", primary_muscle_group: "Chest", hypertrophy_tier: 1 }),
      ex({ id: "B1", primary_muscle_group: "Back", hypertrophy_tier: 1 }),
    ];
    const out = generateWorkout({
      pool,
      targetGroups: ["Quads"],
      reason: "manual override",
      workoutMode: "standard",
      availableMinutes: 30,
      oneRepMaxLbsByExerciseId: new Map(),
      lastLoggedWeightLbsByExerciseId: new Map(),
      lastPerformedByExerciseId: new Map(),
      now: NOW,
    });
    expect(out.exercises.every((e) => e.exercise.primary_muscle_group === "Quads"))
      .toBe(true);
  });
});
