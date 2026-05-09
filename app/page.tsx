import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Workout App</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Daily hypertrophy planner.
      </p>
      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium">Status</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {user ? `Signed in as ${user.email}` : "Not signed in"}
        </p>
      </div>
      <p className="mt-6 text-xs text-zinc-500">
        Scaffold milestone — auth, onboarding, and the dashboard land next.
      </p>
    </main>
  );
}
