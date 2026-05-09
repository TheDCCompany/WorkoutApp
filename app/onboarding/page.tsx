import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
      <p className="mt-1 text-sm text-zinc-500">Signed in as {user.email}.</p>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium">Onboarding coming next</p>
        <p className="mt-1 text-zinc-500">
          You&rsquo;ll select your exercise pool and (optionally) enter maxes
          for major lifts here.
        </p>
      </div>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </main>
  );
}
