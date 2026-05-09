import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateWorkoutAction } from "../actions";
import {
  ALL_OVERRIDE_OPTIONS,
  AVAILABLE_MINUTE_OPTIONS,
} from "@/types/domain";

export default async function OverridePage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string; mode?: string }>;
}) {
  const { time: timeRaw, mode: modeRaw } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const timeNum = Number(timeRaw);
  const time = (AVAILABLE_MINUTE_OPTIONS as number[]).includes(timeNum)
    ? timeNum
    : 45;
  const mode = modeRaw === "bodyweight" ? "bodyweight" : "standard";

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Pick a muscle group
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {time} min · {mode === "bodyweight" ? "Bodyweight" : "Standard"} mode
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {ALL_OVERRIDE_OPTIONS.map((opt) => (
          <form key={opt} action={generateWorkoutAction}>
            <input type="hidden" name="available_minutes" value={time} />
            <input type="hidden" name="workout_mode" value={mode} />
            <input type="hidden" name="override_muscle_group" value={opt} />
            <button
              type="submit"
              className="w-full rounded-md border border-zinc-300 px-3 py-3 text-sm font-medium text-zinc-700 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
            >
              {opt}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
