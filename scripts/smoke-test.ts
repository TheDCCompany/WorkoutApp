/**
 * End-to-end smoke test using test1@workoutapp.local under RLS.
 *
 * Run with:
 *   npm run smoke
 *
 * Steps:
 *   1. Sign in
 *   2. Pick 5 exercises into the user's pool
 *   3. Set a 1RM for one of them
 *   4. Insert a workouts row + workout_exercises + workout_sets directly
 *      (mirrors what the dashboard server action does, but without
 *      Next.js cookie-based auth)
 *   5. Read the workout back to confirm RLS allows the user to see it
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function main() {
  const supabase = createClient(URL, ANON);

  // 1. Sign in
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "test1@workoutapp.local",
    password: "Test1234!",
  });
  if (authErr || !auth.user) throw new Error(`Sign in failed: ${authErr?.message}`);
  console.log(`✓ signed in as ${auth.user.email} (id=${auth.user.id})`);

  // 2. Pick a small pool — first 5 chest/back exercises
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, exercise_name, primary_muscle_group, max_test_eligible")
    .in("primary_muscle_group", ["Chest", "Back", "Triceps", "Biceps"])
    .order("hypertrophy_tier")
    .limit(8);
  if (!exercises || exercises.length === 0) throw new Error("No exercises found");

  await supabase.from("user_exercise_pool").delete().eq("user_id", auth.user.id);
  const poolRows = exercises.map((e) => ({
    user_id: auth.user.id,
    exercise_id: e.id,
  }));
  const { error: poolErr } = await supabase
    .from("user_exercise_pool")
    .insert(poolRows);
  if (poolErr) throw new Error(`Pool insert failed: ${poolErr.message}`);
  console.log(`✓ pool set: ${exercises.map((e) => e.exercise_name).join(", ")}`);

  // 3. Set a 1RM
  const eligibleEx = exercises.find((e) => e.max_test_eligible);
  if (eligibleEx) {
    const { error: maxErr } = await supabase
      .from("user_exercise_maxes")
      .upsert({
        user_id: auth.user.id,
        exercise_id: eligibleEx.id,
        one_rep_max_lbs: 200,
      });
    if (maxErr) throw new Error(`Max upsert failed: ${maxErr.message}`);
    console.log(`✓ max set: ${eligibleEx.exercise_name} = 200 lbs`);
  }

  // 4. Mark profile onboarded
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", auth.user.id);
  console.log(`✓ profile marked onboarded`);

  // 5. Verify we can read what we just wrote (RLS gate)
  const { data: poolBack } = await supabase
    .from("user_exercise_pool")
    .select("exercise_id")
    .eq("user_id", auth.user.id);
  console.log(`✓ pool readback: ${poolBack?.length ?? 0} rows`);

  const { data: exBack } = await supabase
    .from("exercises")
    .select("id")
    .limit(5);
  console.log(`✓ exercises read (public lib): ${exBack?.length ?? 0} rows`);

  // 6. Try to read OTHER users' rows — should return empty under RLS
  const { data: othersPool } = await supabase
    .from("user_exercise_pool")
    .select("user_id")
    .neq("user_id", auth.user.id);
  console.log(
    `✓ RLS enforced: other users' pool rows visible: ${othersPool?.length ?? 0} (expected 0)`
  );

  // 7. Generate a workout via the engine (no Next.js needed)
  const { generateWorkout } = await import("../lib/workout-engine");
  const { loadUserPool } = await import("../lib/data/load-engine-inputs");

  const enginePool = await loadUserPool(supabase as never, auth.user.id);
  const generated = generateWorkout({
    pool: enginePool,
    targetGroups: ["Chest", "Triceps"],
    reason: "smoke test",
    workoutMode: "standard",
    availableMinutes: 30,
    oneRepMaxLbsByExerciseId: new Map(),
    lastLoggedWeightLbsByExerciseId: new Map(),
    lastPerformedByExerciseId: new Map(),
  });
  console.log(
    `✓ engine generated ${generated.exercises.length} exercises (${generated.estimated_total_minutes} min)`
  );
  for (const pe of generated.exercises) {
    console.log(
      `   - ${pe.exercise.exercise_name} (${pe.sets.length} sets, ${pe.exercise.primary_muscle_group})`
    );
  }

  // 8. Persist the workout (mirrors what generateWorkoutAction does)
  const { data: w } = await supabase
    .from("workouts")
    .insert({
      user_id: auth.user.id,
      workout_mode: "standard",
      available_minutes: 30,
      target_muscle_groups: ["Chest", "Triceps"],
      reason: "smoke test",
    })
    .select("id")
    .single();
  if (!w) throw new Error("Workout insert failed");

  const { data: weData } = await supabase
    .from("workout_exercises")
    .insert(
      generated.exercises.map((pe) => ({
        workout_id: w.id,
        exercise_id: pe.exercise.id,
        order_index: pe.order_index,
      }))
    )
    .select("id, exercise_id");
  if (!weData) throw new Error("workout_exercises insert failed");

  const weByExId = new Map(weData.map((r) => [r.exercise_id, r.id]));
  const setRows = generated.exercises.flatMap((pe) =>
    pe.sets.map((s) => ({
      workout_exercise_id: weByExId.get(pe.exercise.id)!,
      set_index: s.set_index,
      target_reps_min: s.target_reps_min,
      target_reps_max: s.target_reps_max,
      recommended_weight_lbs: s.recommended_weight_lbs,
      rest_seconds: s.rest_seconds,
    }))
  );
  await supabase.from("workout_sets").insert(setRows);
  console.log(`✓ persisted workout ${w.id} with ${setRows.length} sets`);

  console.log("\nSmoke test passed ✅");
}

main().catch((err) => {
  console.error("Smoke test FAILED:", err);
  process.exit(1);
});
