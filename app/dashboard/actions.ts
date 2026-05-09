"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadUserPool,
  loadMaxes,
  loadLastLoggedWeights,
  loadLastPerformed,
  loadRecoveryRows,
} from "@/lib/data/load-engine-inputs";
import { generateWorkout } from "@/lib/workout-engine";
import {
  buildRecoveryStates,
  expandOverride,
  recommendMuscleGroups,
} from "@/lib/recovery";
import type {
  AvailableMinutes,
  MuscleGroup,
  MuscleGroupOverride,
  WorkoutMode,
} from "@/types/domain";
import {
  ALL_OVERRIDE_OPTIONS,
  AVAILABLE_MINUTE_OPTIONS,
} from "@/types/domain";

function parseTime(raw: FormDataEntryValue | null): AvailableMinutes {
  const n = Number(raw);
  return (AVAILABLE_MINUTE_OPTIONS as number[]).includes(n)
    ? (n as AvailableMinutes)
    : 45;
}

function parseMode(raw: FormDataEntryValue | null): WorkoutMode {
  return raw === "bodyweight" ? "bodyweight" : "standard";
}

function parseOverride(
  raw: FormDataEntryValue | null
): MuscleGroupOverride | undefined {
  const s = String(raw ?? "");
  return (ALL_OVERRIDE_OPTIONS as string[]).includes(s)
    ? (s as MuscleGroupOverride)
    : undefined;
}

export async function generateWorkoutAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const availableMinutes = parseTime(formData.get("available_minutes"));
  const workoutMode = parseMode(formData.get("workout_mode"));
  const override = parseOverride(formData.get("override_muscle_group"));

  // Load engine inputs in parallel
  const [pool, maxes, lastWeights, lastPerformed, recoveryRows] = await Promise.all([
    loadUserPool(supabase, user.id),
    loadMaxes(supabase, user.id),
    loadLastLoggedWeights(supabase, user.id),
    loadLastPerformed(supabase, user.id),
    loadRecoveryRows(supabase, user.id),
  ]);

  if (pool.length === 0) {
    redirect("/onboarding?error=empty_pool");
  }

  // Determine target groups + reason.
  let targetGroups: MuscleGroup[];
  let reason: string;
  if (override) {
    targetGroups = expandOverride(override);
    reason = `Manual override: ${override}.`;
  } else {
    const states = buildRecoveryStates(
      recoveryRows.map((r) => ({
        muscle_group: r.muscle_group as MuscleGroup,
        last_trained_at: r.last_trained_at,
        recent_hard_sets: r.recent_hard_sets,
        average_fatigue_score: Number(r.average_fatigue_score),
      }))
    );
    const rec = recommendMuscleGroups(states);
    targetGroups = rec.groups;
    reason = rec.reason;
  }

  const workout = generateWorkout({
    pool,
    targetGroups,
    reason,
    workoutMode,
    availableMinutes,
    oneRepMaxLbsByExerciseId: maxes,
    lastLoggedWeightLbsByExerciseId: lastWeights,
    lastPerformedByExerciseId: lastPerformed,
  });

  if (workout.exercises.length === 0) {
    redirect("/dashboard?error=no_exercises_match");
  }

  // Persist: workouts -> workout_exercises -> workout_sets
  const { data: workoutRow, error: insErr } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      workout_mode: workoutMode,
      available_minutes: availableMinutes,
      target_muscle_groups: targetGroups,
      reason,
    })
    .select("id")
    .single();
  if (insErr || !workoutRow) {
    redirect(
      `/dashboard?error=${encodeURIComponent(insErr?.message ?? "insert_failed")}`
    );
  }

  const weRows = workout.exercises.map((pe) => ({
    workout_id: workoutRow.id,
    exercise_id: pe.exercise.id,
    order_index: pe.order_index,
    notes: pe.notes,
  }));
  const { data: weData, error: weErr } = await supabase
    .from("workout_exercises")
    .insert(weRows)
    .select("id, exercise_id, order_index");
  if (weErr || !weData) {
    redirect(
      `/dashboard?error=${encodeURIComponent(weErr?.message ?? "we_insert_failed")}`
    );
  }

  // Map exercise_id -> workout_exercise_id for the sets insert.
  const weByExerciseId = new Map(
    weData.map((row) => [row.exercise_id, row.id])
  );

  const setRows = workout.exercises.flatMap((pe) =>
    pe.sets.map((s) => ({
      workout_exercise_id: weByExerciseId.get(pe.exercise.id)!,
      set_index: s.set_index,
      target_reps_min: s.target_reps_min,
      target_reps_max: s.target_reps_max,
      recommended_weight_lbs: s.recommended_weight_lbs,
      rest_seconds: s.rest_seconds,
    }))
  );

  if (setRows.length > 0) {
    const { error: setErr } = await supabase.from("workout_sets").insert(setRows);
    if (setErr) {
      redirect(
        `/dashboard?error=${encodeURIComponent(setErr.message)}`
      );
    }
  }

  redirect(`/workout/${workoutRow.id}`);
}

export async function goToOverrideAction(formData: FormData) {
  const time = parseTime(formData.get("available_minutes"));
  const mode = parseMode(formData.get("workout_mode"));
  redirect(`/dashboard/override?time=${time}&mode=${mode}`);
}
