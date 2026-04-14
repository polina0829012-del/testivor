import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export async function AppHeader() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return (
    <header className="sticky top-0 z-[100] isolate border-b border-black/5 bg-[hsl(var(--surface))]/95 backdrop-blur dark:border-white/10">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_auto] sm:gap-3 sm:px-4">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm font-medium sm:gap-2">
          <Link
            href="/dashboard"
            className="relative z-[1] inline-flex min-h-9 min-w-[6.5rem] touch-manipulation items-center rounded-lg px-2.5 py-1.5 text-sm text-[hsl(var(--accent))] ring-offset-2 hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] dark:hover:bg-white/[0.06]"
          >
            Interview IQ
          </Link>
          <Link
            href="/dashboard"
            className="relative z-[1] inline-flex min-h-9 items-center rounded-lg px-2.5 py-1.5 text-sm text-[hsl(var(--muted))] touch-manipulation ring-offset-2 hover:bg-black/[0.04] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] dark:hover:bg-white/[0.06]"
          >
            Главная
          </Link>
        </nav>
        <div className="flex shrink-0 items-center justify-start gap-2 sm:justify-end">
          <span className="hidden max-w-[160px] truncate text-xs text-[hsl(var(--muted))] sm:inline">
            {session.user?.email}
          </span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
