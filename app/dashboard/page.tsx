import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { generateWorkoutAction, goToOverrideAction } from "./actions";
import { loadRecoveryRows } from "@/lib/data/load-engine-inputs";
import { buildRecoveryStates, recommendMuscleGroups } from "@/lib/recovery";
import type { MuscleGroup } from "@/types/domain";
import { AVAILABLE_MINUTE_OPTIONS } from "@/types/domain";

const ERROR_MESSAGES: Record<string, string> = {
  empty_pool: "Your exercise pool is empty. Pick some exercises first.",
  no_exercises_match:
    "We couldn't find exercises matching that mode/group in your pool. Try a different override.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? ERROR_MESSAGES[error] ?? decodeURIComponent(error)
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const recoveryRows = await loadRecoveryRows(supabase, user.id);
  const states = buildRecoveryStates(
    recoveryRows.map((r) => ({
      muscle_group: r.muscle_group as MuscleGroup,
      last_trained_at: r.last_trained_at,
      recent_hard_sets: r.recent_hard_sets,
      average_fatigue_score: Number(r.average_fatigue_score),
    }))
  );
  const rec = recommendMuscleGroups(states);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 text-xs text-zinc-500">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      {errorMessage && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Recommended today
        </p>
        <p className="mt-1 text-lg font-semibold">{rec.groups.join(" + ")}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {rec.reason}
        </p>
      </section>

      <form action={generateWorkoutAction} className="mt-6 space-y-5">
        <fieldset>
          <legend className="text-sm font-medium">Available time</legend>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {AVAILABLE_MINUTE_OPTIONS.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-1 py-2 text-sm font-medium text-zinc-700 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white dark:border-zinc-700 dark:text-zinc-300 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-900"
              >
                <input
                  type="radio"
                  name="available_minutes"
                  value={m}
                  defaultChecked={m === 45}
                  className="sr-only"
                />
                {m}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">minutes</p>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Mode</legend>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-2 py-2 text-sm font-medium text-zinc-700 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white dark:border-zinc-700 dark:text-zinc-300 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-900">
              <input
                type="radio"
                name="workout_mode"
                value="standard"
                defaultChecked
                className="sr-only"
              />
              Standard
            </label>
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-2 py-2 text-sm font-medium text-zinc-700 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white dark:border-zinc-700 dark:text-zinc-300 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-900">
              <input
                type="radio"
                name="workout_mode"
                value="bodyweight"
                className="sr-only"
              />
              Bodyweight
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Generate workout
        </button>

        <button
          type="submit"
          formAction={goToOverrideAction}
          className="w-full rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Override muscle group →
        </button>
      </form>

      <nav className="mt-8 flex justify-center gap-4 text-sm">
        <Link href="/history" className="text-zinc-500 hover:underline">
          History
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <Link href="/onboarding" className="text-zinc-500 hover:underline">
          Edit pool
        </Link>
      </nav>
    </main>
  );
}
