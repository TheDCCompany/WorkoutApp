import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { savePoolAction } from "./actions";
import type { ExerciseRow } from "@/types/database";
import type { MuscleGroup } from "@/types/domain";
import { DIRECT_MUSCLE_GROUPS } from "@/types/domain";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: exercises }, { data: pool }] = await Promise.all([
    supabase
      .from("exercises")
      .select(
        "id, exercise_name, primary_muscle_group, equipment_type, hypertrophy_tier, workout_mode, beginner_friendly"
      )
      .order("hypertrophy_tier", { ascending: true })
      .order("exercise_name", { ascending: true }),
    supabase
      .from("user_exercise_pool")
      .select("exercise_id")
      .eq("user_id", user.id),
  ]);

  const selected = new Set((pool ?? []).map((p) => p.exercise_id));

  const grouped = new Map<MuscleGroup, Pick<ExerciseRow, "id" | "exercise_name" | "primary_muscle_group" | "equipment_type" | "hypertrophy_tier" | "workout_mode" | "beginner_friendly">[]>();
  for (const mg of DIRECT_MUSCLE_GROUPS) grouped.set(mg, []);
  for (const ex of (exercises ?? []) as Pick<ExerciseRow, "id" | "exercise_name" | "primary_muscle_group" | "equipment_type" | "hypertrophy_tier" | "workout_mode" | "beginner_friendly">[]) {
    const list = grouped.get(ex.primary_muscle_group as MuscleGroup);
    if (list) list.push(ex);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Step 1 of 2
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Pick your exercise pool
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Select the exercises you can actually do at your gym. The workout
          generator will only choose from these.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {decodeURIComponent(error)}
        </p>
      )}

      <form action={savePoolAction} className="space-y-6">
        {DIRECT_MUSCLE_GROUPS.map((mg) => {
          const list = grouped.get(mg) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={mg} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
              <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                {mg}{" "}
                <span className="font-normal text-zinc-500">({list.length})</span>
              </h2>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {list.map((ex) => (
                  <li key={ex.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <input
                        type="checkbox"
                        name="exercise_id"
                        value={ex.id}
                        defaultChecked={selected.has(ex.id)}
                        className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">
                          {ex.exercise_name}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {ex.equipment_type} · Tier {ex.hypertrophy_tier}
                          {ex.workout_mode === "bodyweight" && " · Bodyweight"}
                          {ex.workout_mode === "both" && " · Standard or Bodyweight"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Save pool & continue
          </button>
        </div>
      </form>
    </main>
  );
}
