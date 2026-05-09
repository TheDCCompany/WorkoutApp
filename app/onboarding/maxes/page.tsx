import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveMaxesAction, skipMaxesAction } from "../actions";

export default async function OnboardingMaxesPage({
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

  // Pull eligible exercises in the user's pool. We need:
  //   1) the exercise rows (joined via the pool)
  //   2) any maxes the user has already saved
  const { data: poolWithExercise } = await supabase
    .from("user_exercise_pool")
    .select(
      "exercise_id, exercise:exercises ( id, exercise_name, primary_muscle_group, max_test_eligible )"
    )
    .eq("user_id", user.id);

  const eligible = (poolWithExercise ?? [])
    // The Supabase JS types model the joined relation as an array; flatten it.
    .map((row) => {
      const ex = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
      return ex as
        | {
            id: string;
            exercise_name: string;
            primary_muscle_group: string;
            max_test_eligible: boolean;
          }
        | undefined;
    })
    .filter(
      (ex): ex is {
        id: string;
        exercise_name: string;
        primary_muscle_group: string;
        max_test_eligible: boolean;
      } => Boolean(ex && ex.max_test_eligible)
    )
    .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));

  const { data: maxes } = await supabase
    .from("user_exercise_maxes")
    .select("exercise_id, one_rep_max_lbs")
    .eq("user_id", user.id);

  const maxByExercise = new Map(
    (maxes ?? []).map((m) => [m.exercise_id, Number(m.one_rep_max_lbs)])
  );

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Step 2 of 2
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Optional: enter your maxes
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Estimated 1-rep maxes let us suggest weights. You can skip this and
          add them later.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {decodeURIComponent(error)}
        </p>
      )}

      {eligible.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p>
            None of the exercises in your pool are max-test eligible. You&rsquo;re
            all set.
          </p>
          <form action={skipMaxesAction} className="mt-4">
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Finish onboarding
            </button>
          </form>
        </div>
      ) : (
        <form action={saveMaxesAction} className="space-y-4">
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {eligible.map((ex) => (
              <li key={ex.id} className="px-4 py-3">
                <label className="flex items-center gap-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      {ex.exercise_name}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {ex.primary_muscle_group}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      name={`max_${ex.id}`}
                      min={0}
                      step={5}
                      defaultValue={maxByExercise.get(ex.id) ?? ""}
                      inputMode="numeric"
                      className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-right text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
                      placeholder="—"
                    />
                    <span className="text-xs text-zinc-500">lbs</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Save & finish
            </button>
            <button
              type="submit"
              formAction={skipMaxesAction}
              className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Skip
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
