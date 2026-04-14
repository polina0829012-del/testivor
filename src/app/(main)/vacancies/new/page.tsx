import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronLeft } from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { CreateVacancyForm } from "./create-vacancy-form";

export default async function NewVacancyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="w-full space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-xl border border-black/[0.08] bg-gradient-to-br from-[hsl(var(--accent))]/[0.1] via-[hsl(var(--surface))] to-[hsl(var(--surface))] px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:from-[hsl(var(--accent))]/12 dark:ring-white/[0.06] sm:px-5 sm:py-3.5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[hsl(var(--accent))]/10 blur-3xl dark:bg-[hsl(var(--accent))]/18" />
        <div className="relative space-y-1.5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--muted))] transition hover:text-[hsl(var(--accent))] sm:text-sm"
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            Главная
          </Link>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">Новая вакансия</h1>
        </div>
      </div>
      <CreateVacancyForm />
    </div>
  );
}
