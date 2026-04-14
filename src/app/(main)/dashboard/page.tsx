import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FolderKanban, LayoutDashboard } from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { DashboardCatalogToggle } from "@/components/dashboard-catalog-toggle";
import { DashboardStats } from "@/components/dashboard-stats";
import { countCandidatesWithRejectRecommendation } from "@/lib/candidate-outcome-stats";
import { PRIORITY_LABEL, vacancyStatusDisplayLabel } from "@/lib/vacancy-labels";
import { isLlmConfigured, isVercelDeployment } from "@/lib/ai";

export const dynamic = "force-dynamic";

type CatalogSearch = { catalog?: string };

const listCardClass =
  "flex h-full min-h-[7rem] flex-col gap-2 rounded-xl border border-black/[0.07] bg-[hsl(var(--surface))] px-3.5 py-3 text-sm shadow-sm ring-1 ring-black/[0.03] transition hover:border-[hsl(var(--accent))]/45 hover:shadow-md hover:ring-[hsl(var(--accent))]/12 dark:border-white/[0.08] dark:ring-white/[0.04]";

const hiredClosedCardClass =
  "flex h-full min-h-[7rem] flex-col gap-2 rounded-xl border border-emerald-500/45 bg-gradient-to-br from-emerald-500/[0.1] to-[hsl(var(--surface))] px-3.5 py-3 text-sm shadow-sm ring-1 ring-emerald-500/25 transition hover:border-emerald-500/65 hover:shadow-md hover:ring-emerald-500/30 dark:border-emerald-500/40 dark:from-emerald-500/[0.14] dark:ring-emerald-500/20";

function vacancyListCardClass(v: { status: string; hiredCandidateId: string | null }) {
  return v.status === "closed" && v.hiredCandidateId != null ? hiredClosedCardClass : listCardClass;
}

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

  const [
    statusGroups,
    totalVacancies,
    vacanciesMine,
    vacanciesAll,
    hiredPlacements,
    candidateSummaries,
  ] = await Promise.all([
    prisma.vacancy.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.vacancy.count(),
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
    prisma.vacancy.count({ where: { hiredCandidateId: { not: null } } }),
    prisma.candidate.findMany({ select: { summaryJson: true } }),
  ]);

  const rejectRecommendationCount = countCandidatesWithRejectRecommendation(candidateSummaries);

  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count._all;
  }
  const llmOk = isLlmConfigured();
  const onVercel = isVercelDeployment();

  return (
    <div className="w-full space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-xl border border-black/[0.08] bg-gradient-to-br from-[hsl(var(--accent))]/[0.1] via-[hsl(var(--surface))] to-[hsl(var(--surface))] px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:from-[hsl(var(--accent))]/12 dark:ring-white/[0.06] sm:px-5 sm:py-3.5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[hsl(var(--accent))]/10 blur-3xl dark:bg-[hsl(var(--accent))]/18" />
        <div className="relative flex items-center gap-2.5 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] shadow-sm dark:bg-[hsl(var(--accent))]/20">
            <LayoutDashboard className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="min-w-0 text-lg font-bold tracking-tight sm:text-xl">Главная</h1>
        </div>
      </div>

      <DashboardStats
        totalVacancies={totalVacancies}
        byStatus={byStatus}
        hiredCount={hiredPlacements}
        rejectRecommendationCount={rejectRecommendationCount}
      />

      {!llmOk ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50"
        >
          <p className="font-medium">ИИ не настроен на сервере</p>
          <p className="mt-1 text-xs opacity-90">
            {onVercel
              ? "Сервер не видит ключ: в Vercel → Settings → Environment Variables добавьте для той же среды, что и деплой (часто Production), переменные: OPENAI_API_KEY или OPENROUTER_API_KEY, OPENAI_BASE_URL=https://openrouter.ai/api/v1, OPENAI_MODEL=openai/gpt-4o-mini. Сохраните и Redeploy. Локальный .env с ПК сюда не подставляется."
              : "Локально: в корне проекта в .env или .env.local задайте OPENAI_API_KEY или OPENROUTER_API_KEY (и при OpenRouter — OPENAI_BASE_URL / OPENAI_MODEL), полностью перезапустите npm run dev. Если открываете сайт на vercel.app — ключи нужны в панели Vercel, не только в .env."}
          </p>
        </div>
      ) : null}

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
                  {catalogAll ? "Каталог" : "Мои вакансии"}
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
                    <Link href={href} className={vacancyListCardClass(v)}>
                      <span className="line-clamp-2 font-medium leading-snug">{v.title}</span>
                      <div className="mt-auto flex flex-wrap gap-1.5">
                        <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                          {PRIORITY_LABEL[v.priority] ?? v.priority}
                        </span>
                        <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                          {vacancyStatusDisplayLabel(v.status, v.hiredCandidateId)}
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
                <Link href={`/vacancies/${v.id}`} className={vacancyListCardClass(v)}>
                  <span className="line-clamp-2 font-medium leading-snug">{v.title}</span>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                      {PRIORITY_LABEL[v.priority] ?? v.priority}
                    </span>
                    <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[11px] dark:bg-white/10">
                      {vacancyStatusDisplayLabel(v.status, v.hiredCandidateId)}
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
