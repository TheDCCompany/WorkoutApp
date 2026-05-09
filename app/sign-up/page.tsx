import Link from "next/link";
import { signUpAction } from "@/app/login/actions";

const MESSAGES: Record<string, string> = {
  missing_fields: "Please enter both email and password.",
  password_too_short: "Password must be at least 8 characters.",
  check_email: "Almost there — check your email to confirm the account.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;
  const errorMessage = error
    ? MESSAGES[error] ?? decodeURIComponent(error)
    : null;
  const infoMessage = info ? MESSAGES[info] ?? null : null;

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Email and password — that's it.
      </p>

      <form action={signUpAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="block text-sm font-medium">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            At least 8 characters.
          </span>
        </label>

        {errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}
        {infoMessage && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {infoMessage}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Sign up
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link className="font-medium text-zinc-900 underline dark:text-zinc-100" href="/login">
          Log in
        </Link>
      </p>
    </main>
  );
}
