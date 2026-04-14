import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { PRIORITY_LABEL, vacancyStatusDisplayLabel } from "@/lib/vacancy-labels";

export default async function BrowseVacanciesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const vacancies = await prisma.vacancy.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
      _count: { select: { candidates: true, blocks: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-[hsl(var(--muted))] hover:underline">
          ← Главная / мои вакансии
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Каталог вакансий</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted))]">
          Вакансии всех HR в системе. Открывайте карточку для просмотра описания и плана интервью (без данных кандидатов и внутренних заметок владельца).
        </p>
      </div>

      {vacancies.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted))]">Пока нет ни одной вакансии.</p>
      ) : (
        <ul className="space-y-2">
          {vacancies.map((v) => {
            const owner = v.user.name?.trim() || v.user.email;
            const mine = v.userId === userId;
            const href = mine ? `/vacancies/${v.id}` : `/vacancies/browse/${v.id}`;
            return (
              <li key={v.id}>
                <Link
                  href={href}
                  className="flex flex-col gap-2 rounded-xl border border-black/10 bg-[hsl(var(--surface))] px-4 py-3 transition hover:border-[hsl(var(--accent))]/40 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{v.title}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted))]">
                      <span>HR: {owner}</span>
                      {mine ? (
                        <span className="rounded-md bg-[hsl(var(--accent))]/15 px-2 py-0.5 font-medium text-[hsl(var(--accent))]">
                          Моя вакансия
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-md bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                        {PRIORITY_LABEL[v.priority] ?? v.priority}
                      </span>
                      <span className="rounded-md bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                        {vacancyStatusDisplayLabel(v.status, v.hiredCandidateId)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[hsl(var(--muted))]">
                    {v._count.candidates} кандидатов · {v._count.blocks} блоков
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
