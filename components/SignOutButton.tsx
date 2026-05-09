import { signOutAction } from "@/app/login/actions";

export function SignOutButton({
  className = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline",
}: {
  className?: string;
}) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
