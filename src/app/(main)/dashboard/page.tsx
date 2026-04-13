import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FolderKanban, LayoutDashboard } from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { DashboardCatalogToggle } from "@/components/dashboard-catalog-toggle";
import { DashboardStats } from "@/components/dashboard-stats";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/vacancy-labels";
import { isLlmConfigured, isVercelDeployment } from "@/lib/ai";

export const dynamic = "force-dynamic";

type CatalogSearch = { catalog?: string };

const listCardClass =
  "flex h-full min-h-[7rem] flex-col gap-2 rounded-xl border border-black/[0.07] bg-[hsl(var(--surface))] px-3.5 py-3 text-sm shadow-sm ring-1 ring-black/[0.03] transition hover:border-[hsl(var(--accent))]/45 hover:shadow-md hover:ring-[hsl(var(--accent))]/12 dark:border-white/[0.08] dark:ring-white/[0.04]";

const catalogShell =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: CatalogSearch | Promise<CatalogSearch>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const sp = await Promise.resolve(searchParams ?? {});
  const catalogAll = sp.catalog === "all";

  const [statusGroups, totalVacancies, totalCandidates, vacanciesMine, vacanciesAll] = await Promise.all([
    prisma.vacancy.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.vacancy.count(),
    prisma.candidate.count(),
    !catalogAll
      ? prisma.vacancy.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { candidates: true, blocks: true } },
          },
        })
      : Promise.resolve(null),
    catalogAll
      ? prisma.vacancy.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { email: true, name: true } },
            _count: { select: { candidates: true, blocks: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count._all;
  }
  const closedCount = byStatus.closed ?? 0;
  const llmOk = isLlmConfigured();
  const onVercel = isVercelDeployment();

  return (
    <div className="w-full space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-br from-[hsl(var(--accent))]/[0.12] via-[hsl(var(--surface))] to-[hsl(var(--surface))] p-6 shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:from-[hsl(var(--accent))]/15 dark:ring-white/[0.06] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[hsl(var(--accent))]/10 blur-3xl dark:bg-[hsl(var(--accent))]/20" />
        <div className="relative flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] shadow-sm dark:bg-[hsl(var(--accent))]/25">
            <LayoutDashboard className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Главная</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted))] sm:text-[15px]">
              Сводка по системе и каталог вакансий. Переключайте «Мои» и «Все» ниже.
            </p>
          </div>
        </div>
      </div>

      <DashboardStats
        totalVacancies={totalVacancies}
        totalCandidates={totalCandidates}
        closedCount={closedCount}
        byStatus={byStatus}
      />

      <div
        role="status"
        className={
          llmOk
            ? "rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"
            : "rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50"
        }
      >
        <p className="font-medium">{llmOk ? "ИИ подключён" : "ИИ не настроен на сервере"}</p>
        <p className="mt-1 text-xs opacity-90">
          {llmOk
            ? "ИИ выполняется на сервере: любой пользователь, вошедший на этот сайт, использует одни и те же настройки LLM (ваш ключ на хостинге)."
            : onVercel
              ? "Сервер Vercel не видит ваш локальный .env. Откройте проект → Settings → Environment Variables → Production: добавьте OPENAI_API_KEY или OPENROUTER_API_KEY, OPENAI_BASE_URL=https://openrouter.ai/api/v1, OPENAI_MODEL=openai/gpt-4o-mini, сохраните и сделайте Redeploy — после этого ИИ заработает у всех по ссылке на приложение."
              : "Добавьте в .env или .env.local переменные OPENAI_API_KEY, OPENROUTER_API_KEY, LLM_API_KEY или AI_API_KEY и при необходимости OPENAI_BASE_URL / OPENAI_MODEL, затем перезапустите dev."}
        </p>
      </div>

      <section className={catalogShell}>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] dark:bg-[hsl(var(--accent))]/20">
                <FolderKanban className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <DashboardCatalogToggle mode={catalogAll ? "all" : "mine"} />
                <h2 className="mt-3 text-lg font-semibold tracking-tight">
                  {catalogAll ? "Все вакансии" : "Мои вакансии"}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted))]">
                  {catalogAll
                    ? "Чужие карточки — просмотр плана без кандидатов и внутренних заметок; свои — полный доступ."
                    : "Редактирование, кандидаты и план интервью — только у вас."}
                </p>
              </div>
            </div>
          </div>
          {!catalogAll ? (
            <Link
              href="/vacancies/new"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-[hsl(var(--accent))]/25 transition hover:opacity-[0.96]"
            >
              Создать новую вакансию
            </Link>
          ) : null}
        </div>

        {catalogAll ? (
          vacanciesAll!.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-6 text-center text-sm text-[hsl(var(--muted))] dark:border-white/15 dark:bg-white/[0.02]">
              Пока нет ни одной вакансии в системе.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {vacanciesAll!.map((v) => {
                const owner = v.user.name?.trim() || v.user.email;
                const mine = v.userId === userId;
                const href = mine ? `/vacancies/${v.id}` : `/vacancies/browse/${v.id}`;
                return (
                  <li key={v.id} className="min-w-0">
                    <Link href={href} className={listCardClass}>
                      <span className="line-clamp-2 font-medium leading-snug">{v.title}</span>
                      <div className="mt-auto flex flex-wrap gap-1.5">
                        <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                          {PRIORITY_LABEL[v.priority] ?? v.priority}
                        </span>
                        <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                          {STATUS_LABEL[v.status] ?? v.status}
                        </span>
                        {mine ? (
                          <span className="rounded-lg bg-[hsl(var(--accent))]/15 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--accent))]">
                            моя
                          </span>
                        ) : null}
                      </div>
                      <span className="line-clamp-1 text-[11px] text-[hsl(var(--muted))]">HR: {owner}</span>
                      <span className="text-[11px] text-[hsl(var(--muted))]">
                        {v._count.candidates} канд. · {v._count.blocks} блок.
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : vacanciesMine!.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-6 text-center text-sm text-[hsl(var(--muted))] dark:border-white/15 dark:bg-white/[0.02]">
            Пока пусто — нажмите «Создать новую вакансию», чтобы добавить первую.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {vacanciesMine!.map((v) => (
              <li key={v.id} className="min-w-0">
                <Link href={`/vacancies/${v.id}`} className={listCardClass}>
                  <span className="line-clamp-2 font-medium leading-snug">{v.title}</span>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                      {PRIORITY_LABEL[v.priority] ?? v.priority}
                    </span>
                    <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                      {STATUS_LABEL[v.status] ?? v.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-[hsl(var(--muted))]">
                    {v._count.candidates} канд. · {v._count.blocks} блок.
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
