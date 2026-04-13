import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.15),_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12),_transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <div className="absolute right-6 top-6 flex gap-2">
          <ThemeToggle />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--accent))]">
          Interview Intelligence
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Платформа структурированных интервью с AI
        </h1>
        <p className="mt-4 text-lg text-[hsl(var(--muted))]">
          Планы вопросов, протоколы интервьюеров, сводки, расхождения и дашборд — в одном месте.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-[hsl(var(--accent))] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:opacity-95"
            >
              Перейти в кабинет
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl bg-[hsl(var(--accent))] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:opacity-95"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-black/10 px-6 py-3 text-sm font-semibold dark:border-white/15"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
