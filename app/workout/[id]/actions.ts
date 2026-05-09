"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MuscleGroup } from "@/types/domain";

interface SetUpdate {
  id: string;
  actual_reps: number | null;
  actual_weight_lbs: number | null;
  completed: boolean;
  target_reps_min: number;
  target_reps_max: number;
  exercise_id: string;
  fatigue_score_1_10: number;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
}

function parseInt(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseFloat(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function completeWorkoutAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workoutId = String(formData.get("workout_id") ?? "");
  if (!workoutId) redirect("/dashboard");

  // Reload the full workout structure under RLS to get authoritative IDs
  // and the exercise metadata we need for recovery/history rollups.
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .select("id, user_id, completed_at, target_muscle_groups")
    .eq("id", workoutId)
    .maybeSingle();
  if (wErr || !workout) redirect("/dashboard?error=workout_not_found");
  if (workout.user_id !== user.id) redirect("/dashboard?error=forbidden");

  const { data: rows } = await supabase
    .from("workout_sets")
    .select(
      `
      id, target_reps_min, target_reps_max,
      workout_exercise:workout_exercises!inner (
        id, exercise_id, workout_id,
        exercise:exercises (
          id, fatigue_score_1_10, primary_muscle_group, secondary_muscle_groups
        )
      )
    `
    )
    .eq("workout_exercise.workout_id", workoutId);

  if (!rows) redirect("/dashboard?error=load_failed");

  const updates: SetUpdate[] = [];
  for (const row of rows) {
    const we = Array.isArray(row.workout_exercise)
      ? row.workout_exercise[0]
      : row.workout_exercise;
    const ex = Array.isArray(we?.exercise) ? we.exercise[0] : we?.exercise;
    if (!we || !ex) continue;

    const reps = parseInt(formData.get(`set_${row.id}_reps`));
    const weight = parseFloat(formData.get(`set_${row.id}_weight`));
    const completed = formData.get(`set_${row.id}_completed`) === "on";

    updates.push({
      id: row.id,
      actual_reps: reps,
      actual_weight_lbs: weight,
      completed,
      target_reps_min: row.target_reps_min,
      target_reps_max: row.target_reps_max,
      exercise_id: we.exercise_id,
      fatigue_score_1_10: ex.fatigue_score_1_10,
      primary_muscle_group: ex.primary_muscle_group,
      secondary_muscle_groups: ex.secondary_muscle_groups ?? [],
    });
  }

  // Update workout_sets row-by-row. Could batch with PG views, but this is
  // small (handful of rows) and clearer.
  await Promise.all(
    updates.map((u) =>
      supabase
        .from("workout_sets")
        .update({
          actual_reps: u.actual_reps,
          actual_weight_lbs: u.actual_weight_lbs,
          completed: u.completed,
        })
        .eq("id", u.id)
    )
  );

  // Mark workout complete (idempotent — re-completing won't break anything).
  const completedAt = new Date().toISOString();
  await supabase
    .from("workouts")
    .update({ completed_at: completedAt })
    .eq("id", workoutId);

  // ---- Recovery rollup ----
  // For each muscle group touched by completed sets, count hard sets and
  // average the fatigue scores. We use primary group as the canonical
  // muscle for that exercise.
  const completedSets = updates.filter((u) => u.completed);
  type Acc = { sets: number; fatigueSum: number; n: number };
  const byGroup = new Map<string, Acc>();
  for (const s of completedSets) {
    const acc = byGroup.get(s.primary_muscle_group) ?? {
      sets: 0,
      fatigueSum: 0,
      n: 0,
    };
    acc.sets += 1;
    acc.fatigueSum += s.fatigue_score_1_10;
    acc.n += 1;
    byGroup.set(s.primary_muscle_group, acc);
  }

  if (byGroup.size > 0) {
    const recoveryRows = Array.from(byGroup.entries()).map(([group, acc]) => ({
      user_id: user.id,
      muscle_group: group,
      last_trained_at: completedAt,
      recent_hard_sets: acc.sets,
      average_fatigue_score: acc.n > 0 ? acc.fatigueSum / acc.n : 0,
      updated_at: completedAt,
    }));
    await supabase
      .from("muscle_group_recovery")
      .upsert(recoveryRows, { onConflict: "user_id,muscle_group" });
  }

  // ---- Performance history ----
  const historyRows = completedSets
    .filter((s) => s.actual_reps != null)
    .map((s, idx) => ({
      user_id: user.id,
      exercise_id: s.exercise_id,
      performed_at: completedAt,
      weight_lbs: s.actual_weight_lbs,
      reps: s.actual_reps,
      set_index: idx,
      hit_top_of_range:
        s.actual_reps != null && s.actual_reps >= s.target_reps_max,
      missed_target:
        s.actual_reps != null && s.actual_reps < s.target_reps_min,
    }));

  if (historyRows.length > 0) {
    await supabase.from("exercise_performance_history").insert(historyRows);
  }

  redirect(`/workout/${workoutId}/done`);
}

export async function startWorkoutAction(formData: FormData) {
  const workoutId = String(formData.get("workout_id") ?? "");
  if (!workoutId) redirect("/dashboard");

  const supabase = await createClient();
  await supabase
    .from("workouts")
    .update({ started_at: new Date().toISOString() })
    .eq("id", workoutId);
  redirect(`/workout/${workoutId}`);
}
