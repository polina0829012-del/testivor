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
      <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-br from-[hsl(var(--accent))]/[0.12] via-[hsl(var(--surface))] to-[hsl(var(--surface))] p-6 shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:from-[hsl(var(--accent))]/15 dark:ring-white/[0.06] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[hsl(var(--accent))]/10 blur-3xl dark:bg-[hsl(var(--accent))]/20" />
        <Link
          href="/dashboard"
          className="relative inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--muted))] transition hover:text-[hsl(var(--accent))]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Все вакансии
        </Link>
        <h1 className="relative mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Новая вакансия</h1>
        <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-[hsl(var(--muted))] sm:text-[15px]">
          Описание роли и кандидата — одним блоком: так у ИИ и рекрутера больше контекста для плана и подбора. Внутренняя
          заметка видна только вам.
        </p>
      </div>
      <CreateVacancyForm />
    </div>
  );
}
