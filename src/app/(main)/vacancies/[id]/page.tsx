import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronLeft } from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { aggregateVacancyBlockOverallScores } from "@/lib/overall-block-score-agg";
import { vacancyKpi } from "@/lib/stats";
import { recommendationChipClassName } from "@/lib/recommendation-labels";
import { addCandidateForVacancy, removeVacancyAndRedirect } from "@/actions/vacancy-page-actions";
import {
  submitAddBlock,
  submitAddQuestion,
  submitDeleteBlock,
  submitDeleteQuestion,
  submitSaveInterviewPlan,
  submitToggleRequired,
  submitVacancyMeta,
} from "@/actions/vacancy-forms";
import { mergedVacancyProfile } from "@/lib/vacancy-profile";
import { WORK_FORMAT_LABEL } from "@/lib/vacancy-labels";
import { parseQuestionResponseType, questionResponseTypeLabel } from "@/lib/plan-question-types";
import {
  CandidateSearch,
  CompareCandidates,
  DuplicateVacancyButton,
  InterviewPlanBlocksNavigator,
  InterviewPlanSection,
  PlanBlockPanel,
  PlanQuestionReorderButtons,
  VacancyParamsCollapse,
} from "./vacancy-client";
import { FormSubmitButton } from "@/components/form-submit-button";
import { VacancyCloseHirePanel } from "@/components/vacancy-close-hire-panel";
import { VacancyParamsReadonly } from "@/components/vacancy-params-readonly";
import { VacancyPlanReadonly } from "@/components/vacancy-plan-readonly";
import { SavedSuccessOverlay } from "./saved-success-overlay";

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]/45 focus:ring-2 focus:ring-[hsl(var(--accent))]/18 dark:border-white/12 dark:bg-black/35 dark:focus:border-[hsl(var(--accent))]/40";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]";

const candidatesPanelClass =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

function savedQueryFlag(v: string | string[] | undefined): boolean {
  if (v === "1") return true;
  return Array.isArray(v) && v[0] === "1";
}

export default async function VacancyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const v = await prisma.vacancy.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      hiredCandidate: { select: { id: true, name: true } },
      blocks: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } },
      candidates: {
        include: {
          interviewers: {
            include: {
              protocol: { include: { scores: true, questionAnswers: true } },
            },
          },
        },
      },
    },
  });
  if (!v) notFound();

  const blockScoreRows = await prisma.blockScore.findMany({
    where: { planBlock: { vacancyId: v.id } },
    select: {
      score: true,
      protocol: { select: { interviewer: { select: { candidateId: true } } } },
    },
  });
  const scoreAgg = aggregateVacancyBlockOverallScores(blockScoreRows);
  const kpi = {
    ...vacancyKpi(v),
    avgScoreAcrossCandidates: scoreAgg.vacancyAvg,
    avgOverallScoreCount: scoreAgg.scoreCount,
  };
  const readinessCompletePct =
    kpi.candidateCount > 0
      ? Math.min(100, Math.round((kpi.readiness.fullyCompleteCandidates / kpi.candidateCount) * 100))
      : 0;
  const slotAvgPct = kpi.readiness.avgSlotPercentAcrossCandidates;
  const planSaveFormId = `interview-plan-save-${v.id}`;
  const showSaved = savedQueryFlag(searchParams?.saved);
  const closeVacancyInvalidCandidate =
    searchParams?.closeVacancyError === "invalid_candidate";
  const readOnlyHired = v.status === "closed" && v.hiredCandidateId != null;

  return (
    <div className="w-full space-y-6 pb-8">
      <SavedSuccessOverlay vacancyId={v.id} initiallyOpen={showSaved} />
      <div
        className={
          readOnlyHired
            ? "relative overflow-hidden rounded-2xl border border-emerald-500/45 bg-gradient-to-br from-emerald-500/[0.14] via-[hsl(var(--surface))] to-[hsl(var(--surface))] p-6 shadow-sm ring-1 ring-emerald-500/25 dark:border-emerald-500/40 dark:from-emerald-500/[0.18] dark:ring-emerald-500/20 sm:p-7"
            : "relative overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-br from-[hsl(var(--accent))]/[0.12] via-[hsl(var(--surface))] to-[hsl(var(--surface))] p-6 shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:from-[hsl(var(--accent))]/15 dark:ring-white/[0.06] sm:p-7"
        }
      >
        <div
          className={
            readOnlyHired
              ? "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-400/15"
              : "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[hsl(var(--accent))]/10 blur-3xl dark:bg-[hsl(var(--accent))]/20"
          }
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--muted))] transition hover:text-[hsl(var(--accent))]"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              Главная / мои вакансии
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{v.title}</h1>
            {readOnlyHired ? (
              <p className="mt-2 inline-flex rounded-lg border border-emerald-600/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100">
                Закрыта с наймом · только просмотр
              </p>
            ) : null}
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[hsl(var(--muted))] sm:text-[15px]">
              Уровень: {v.level}
              {v.workFormat ? ` · ${WORK_FORMAT_LABEL[v.workFormat] ?? v.workFormat}` : ""}
              {v.targetCloseDate
                ? ` · закрыть до ${new Date(v.targetCloseDate).toLocaleDateString("ru-RU")}`
                : ""}
              <br />
              План обновлён: {new Date(v.planUpdatedAt).toLocaleString("ru-RU")}
            </p>
          </div>
          <div className="relative flex shrink-0 flex-wrap gap-2">
            <a
              href={`/api/vacancies/${v.id}/export`}
              className="inline-flex items-center rounded-xl border border-black/10 bg-white/80 px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur transition hover:bg-white dark:border-white/12 dark:bg-black/40 dark:hover:bg-black/50"
            >
              Выгрузка CSV
            </a>
            {readOnlyHired ? null : <DuplicateVacancyButton vacancyId={v.id} />}
          </div>
        </div>
      </div>

      <section
        className="rounded-xl border border-black/15 bg-black/[0.03] p-4 dark:border-white/15 dark:bg-white/[0.04] sm:p-5"
        aria-label="Сводные показатели по вакансии"
      >
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Быстрый обзор по вакансии</h2>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted))]">
          Кандидаты, готовность протоколов, расхождения интервьюеров, рекомендации ИИ по сводкам и средний балл.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Кандидаты и готовность
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">
              {kpi.candidateCount > 0
                ? `${kpi.readiness.fullyCompleteCandidates}/${kpi.candidateCount}`
                : "—"}
            </p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted))]">
              полностью готовы <span className="text-[hsl(var(--foreground))]">(все слоты сдали протокол)</span>
            </p>
            {kpi.candidateCount > 0 ? (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500/75 dark:bg-emerald-400/70"
                  style={{ width: `${readinessCompletePct}%` }}
                />
              </div>
            ) : null}
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">
              {kpi.candidateCount === 0
                ? "Добавьте кандидатов ниже — здесь появится статистика."
                : slotAvgPct != null
                  ? `В среднем по кандидатам заполнено слотов интервьюеров: ${slotAvgPct}%.`
                  : "У кандидатов пока нет назначенных интервьюеров."}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Расхождения
            </p>
            <p className="mt-1 text-base font-semibold leading-snug text-[hsl(var(--foreground))]">
              {kpi.candidateCount === 0
                ? "Нет данных"
                : `${kpi.withDiscrepancies} из ${kpi.candidateCount}`}
            </p>
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">
              {kpi.candidateCount === 0
                ? "Пока не с кем сравнивать протоколы."
                : "Кандидатов, у которых между интервьюерами разброс общей оценки по блоку больше 2 баллов."}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Рекомендации ИИ
            </p>
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">
              По сохранённым сводкам «AI: сводка» на карточках кандидатов.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${recommendationChipClassName("hire")}`}
              >
                Нанять · {kpi.recommendations.hire}
              </span>
              <span
                className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${recommendationChipClassName("reject")}`}
              >
                Отказ · {kpi.recommendations.reject}
              </span>
              <span
                className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${recommendationChipClassName("additional")}`}
              >
                Доп. · {kpi.recommendations.additional}
              </span>
              <span
                className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${recommendationChipClassName(null)}`}
              >
                Без сводки · {kpi.recommendations.none}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Средний балл
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">
              {kpi.avgScoreAcrossCandidates != null ? `${kpi.avgScoreAcrossCandidates}/5` : "—"}
            </p>
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">
              {(kpi.avgOverallScoreCount ?? 0) > 0
                ? `Среднее по ${kpi.avgOverallScoreCount ?? 0} общим оценкам блоков (1–5) во всех сданных протоколах по вакансии.`
                : "Пока нет ни одной общей оценки блока в протоколах — после отправки протоколов интервьюерами здесь появится число."}
            </p>
          </div>
        </div>
      </section>

      <VacancyCloseHirePanel
        vacancyId={v.id}
        status={v.status}
        candidates={v.candidates.map((c) => ({ id: c.id, name: c.name }))}
        hiredCandidate={v.hiredCandidate}
        showInvalidCandidateError={closeVacancyInvalidCandidate}
      />

      {readOnlyHired ? (
        <>
          <VacancyParamsCollapse defaultOpen>
            <VacancyParamsReadonly
              title={v.title}
              level={v.level}
              workFormat={v.workFormat}
              priority={v.priority}
              status={v.status}
              hiredCandidateId={v.hiredCandidateId}
              targetCloseDate={v.targetCloseDate}
              competencies={v.competencies}
              expectationsForCandidate={v.expectationsForCandidate}
              recruiterInternalNote={v.recruiterInternalNote}
            />
          </VacancyParamsCollapse>
          <VacancyPlanReadonly blocks={v.blocks} />
        </>
      ) : (
        <>
        <VacancyParamsCollapse>
        <form
          action={submitVacancyMeta.bind(null, v.id)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-4"
        >
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelClass}>Название</label>
            <input name="title" defaultValue={v.title} required className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Уровень</label>
            <input name="level" defaultValue={v.level} required className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Формат работы</label>
            <select name="workFormat" defaultValue={v.workFormat} className={fieldClass}>
              <option value="">Не указано</option>
              <option value="office">Офис</option>
              <option value="hybrid">Гибрид</option>
              <option value="remote">Удалённо</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Приоритет</label>
            <select name="priority" defaultValue={v.priority} className={fieldClass}>
              <option value="low">Низкий</option>
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
              <option value="urgent">Срочно</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Статус</label>
            <select name="status" defaultValue={v.status} className={fieldClass}>
              <option value="draft">Черновик</option>
              <option value="active">В работе</option>
              <option value="on_hold">Пауза</option>
              <option value="closed">Деактивирована</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Желательная дата закрытия</label>
            <input
              name="targetCloseDate"
              type="date"
              defaultValue={v.targetCloseDate ? new Date(v.targetCloseDate).toISOString().slice(0, 10) : ""}
              className={fieldClass}
            />
          </div>
          <div className="grid gap-3 sm:col-span-2 lg:col-span-3 xl:grid-cols-2 xl:gap-4 xl:items-stretch">
            <div className="rounded-2xl border border-[hsl(var(--accent))]/20 bg-gradient-to-br from-[hsl(var(--accent))]/[0.06] to-transparent p-4 dark:border-[hsl(var(--accent))]/25 dark:from-[hsl(var(--accent))]/10 sm:p-5">
              <label className={`${labelClass} normal-case`}>Компетенции и пожелания к кандидату</label>
              <p className="mt-1 text-xs leading-snug text-[hsl(var(--muted))]">
                Единое описание для рекрутера, карточки кандидата и ИИ.
              </p>
              <textarea
                name="competencies"
                defaultValue={mergedVacancyProfile(v.competencies, v.expectationsForCandidate)}
                required
                rows={2}
                className={`${fieldClass} mt-2`}
              />
            </div>
            <div className="rounded-2xl border border-dashed border-black/15 p-4 dark:border-white/15 sm:p-5">
              <label className={`${labelClass} normal-case`}>Внутренняя заметка (только HR)</label>
              <textarea
                name="recruiterInternalNote"
                defaultValue={v.recruiterInternalNote}
                rows={2}
                className={`${fieldClass} mt-2`}
              />
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <FormSubmitButton
              pendingLabel="Сохранение…"
              className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-black"
            >
              Сохранить
            </FormSubmitButton>
          </div>
        </form>
      </VacancyParamsCollapse>

      <InterviewPlanSection vacancyId={v.id} hasExistingBlocks={v.blocks.length > 0}>
        <InterviewPlanBlocksNavigator
          vacancyId={v.id}
          blockTabs={v.blocks.map((b) => ({ id: b.id, title: b.title }))}
          sidebarFooter={
            <>
              <p className="text-base font-semibold tracking-tight">Добавить блок</p>
              <form action={submitAddBlock} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="vacancyId" value={v.id} />
                <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]" htmlFor={`add-block-title-${v.id}`}>
                  Название блока
                </label>
                <input
                  id={`add-block-title-${v.id}`}
                  name="title"
                  placeholder="Например: Проектный опыт и мотивация"
                  className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-[hsl(var(--accent))]/45 focus:ring-2 focus:ring-[hsl(var(--accent))]/18 dark:border-white/12 dark:bg-black/35"
                />
                <FormSubmitButton
                  pendingLabel="Добавление…"
                  className="w-full rounded-xl bg-[hsl(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  Добавить блок
                </FormSubmitButton>
              </form>
            </>
          }
        >
          <div className="space-y-5">
            {v.blocks.map((block, blockIdx) => (
              <PlanBlockPanel key={block.id} blockId={block.id}>
                <div className="overflow-hidden rounded-xl border border-black/12 bg-[hsl(var(--surface))] shadow-sm ring-1 ring-black/[0.04] dark:border-white/12 dark:ring-white/[0.06]">
                  <div className="flex flex-col gap-3 border-b border-black/10 bg-gradient-to-r from-[hsl(var(--accent))]/10 to-transparent px-4 py-2.5 dark:border-white/10 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-md bg-[hsl(var(--accent))]/20 px-2 text-xs font-bold tabular-nums text-[hsl(var(--accent))]">
                        {blockIdx + 1}
                      </span>
                      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
                        Блок
                      </span>
                      <label className="sr-only" htmlFor={`blockTitle_${block.id}`}>
                        Название блока
                      </label>
                      <input
                        id={`blockTitle_${block.id}`}
                        form={planSaveFormId}
                        name={`blockTitle_${block.id}`}
                        defaultValue={block.title}
                        placeholder="Название блока"
                        className="min-h-9 min-w-[min(100%,12rem)] flex-1 rounded-lg border border-black/12 bg-white px-3 py-1.5 text-sm shadow-inner dark:border-white/12 dark:bg-black/30 sm:min-w-[8rem]"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <form action={submitToggleRequired}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <FormSubmitButton
                          pendingLabel="Сохранение…"
                          className={
                            block.required
                              ? "rounded-lg border border-emerald-600/80 bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                              : "rounded-lg border border-amber-400/90 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-sm hover:bg-amber-100 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                          }
                        >
                          {block.required ? "Обязательный ✓" : "Сделать обязательным"}
                        </FormSubmitButton>
                      </form>
                      <form action={submitAddQuestion}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <FormSubmitButton
                          pendingLabel="Добавление…"
                          className="rounded-lg border border-black/12 bg-white/80 px-3 py-2 text-sm dark:border-white/12 dark:bg-black/25"
                        >
                          + Вопрос
                        </FormSubmitButton>
                      </form>
                      <form action={submitDeleteBlock}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <FormSubmitButton
                          pendingLabel="Удаление…"
                          className="rounded-lg border border-red-200/90 bg-red-50/50 px-3 py-2 text-sm font-medium text-red-700 ring-red-200/40 transition hover:bg-red-100/80 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/30 dark:hover:bg-red-950/50"
                        >
                          Удалить блок
                        </FormSubmitButton>
                      </form>
                    </div>
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
                        Вопросы ({block.questions.length})
                      </p>
                      <ul className="space-y-3">
                        {block.questions.map((q, qIdx) => {
                          const rt = parseQuestionResponseType(q.responseType);
                          return (
                            <li
                              key={q.id}
                              className="flex flex-col gap-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-start"
                            >
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                                  <span className="inline-flex shrink-0 items-center rounded-md border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--muted))] dark:border-white/15 dark:bg-black/40">
                                    Вопрос {qIdx + 1}
                                  </span>
                                  <span className="text-xs font-semibold text-[hsl(var(--muted))]">Тип ответа интервьюера:</span>
                                  <label className="flex min-w-0 max-w-full cursor-pointer items-start gap-2 rounded-lg border border-black/10 bg-white/90 px-2.5 py-1.5 dark:border-white/12 dark:bg-black/25">
                                    <input
                                      type="radio"
                                      form={planSaveFormId}
                                      name={`questionResponseType_${q.id}`}
                                      value="text"
                                      defaultChecked={rt === "text"}
                                      className="mt-1 shrink-0"
                                    />
                                    <span className="text-sm leading-snug">{questionResponseTypeLabel("text")}</span>
                                  </label>
                                  <label className="flex min-w-0 max-w-full cursor-pointer items-start gap-2 rounded-lg border border-black/10 bg-white/90 px-2.5 py-1.5 dark:border-white/12 dark:bg-black/25">
                                    <input
                                      type="radio"
                                      form={planSaveFormId}
                                      name={`questionResponseType_${q.id}`}
                                      value="rating"
                                      defaultChecked={rt === "rating"}
                                      className="mt-1 shrink-0"
                                    />
                                    <span className="text-sm leading-snug">{questionResponseTypeLabel("rating")}</span>
                                  </label>
                                </div>
                                <div className="min-w-0">
                                  <label className="sr-only" htmlFor={`questionText_${q.id}`}>
                                    Текст вопроса
                                  </label>
                                  <textarea
                                    id={`questionText_${q.id}`}
                                    form={planSaveFormId}
                                    name={`questionText_${q.id}`}
                                    defaultValue={q.text}
                                    rows={2}
                                    className="min-h-[4.5rem] w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm dark:border-white/12 dark:bg-black/30"
                                  />
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2 pt-1 sm:flex-row sm:items-start sm:pt-0.5">
                                <PlanQuestionReorderButtons
                                  vacancyId={v.id}
                                  questionId={q.id}
                                  questionIndex={qIdx}
                                  totalInBlock={block.questions.length}
                                />
                                <form action={submitDeleteQuestion} className="flex items-start">
                                  <input type="hidden" name="questionId" value={q.id} />
                                  <input type="hidden" name="vacancyId" value={v.id} />
                                  <FormSubmitButton
                                    pendingLabel="Удаление…"
                                    className="rounded-md px-2 py-1 text-sm font-medium text-red-600 underline-offset-2 ring-1 ring-transparent transition hover:underline hover:ring-red-300/60 dark:text-red-400 dark:hover:ring-red-800/50"
                                  >
                                    Удалить
                                  </FormSubmitButton>
                                </form>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </PlanBlockPanel>
            ))}
          </div>
        </InterviewPlanBlocksNavigator>
        <p className="mt-3 text-xs text-[hsl(var(--muted))]">
          Названия блоков, тексты вопросов и тип ответа (текст или балл по пункту) сохраняются кнопкой «Сохранить план».
          Добавление, удаление и обязательность — сразу по своим кнопкам. Порядок блоков — перетаскиванием строки в списке
          слева; порядок вопросов в блоке — стрелками у каждого вопроса.
        </p>
        <form id={planSaveFormId} action={submitSaveInterviewPlan.bind(null, v.id)} className="mt-3">
          <FormSubmitButton
            pendingLabel="Сохранение…"
            className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-black"
          >
            Сохранить план
          </FormSubmitButton>
        </form>
      </InterviewPlanSection>
        </>
      )}

      <section className={`${candidatesPanelClass} space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Кандидаты</h2>
            <div className="mt-1 max-w-2xl space-y-2 text-xs leading-snug text-[hsl(var(--muted))]">
              {readOnlyHired ? (
                <p>
                  Режим просмотра: карточки кандидатов открываются для чтения; добавлять слоты и менять план
                  нельзя.
                </p>
              ) : (
                <>
                  <p>
                    ФИО можно не вводить: интервьюер укажет его при отправке протокола — имя сохранится в
                    карточке.
                  </p>
                  <p>
                    Кнопка «Добавить слот интервью» создаёт новую карточку кандидата с двумя интервьюерами по
                    умолчанию и сразу показывает её в списке ниже. Дальше откройте карточку: при необходимости
                    переименуйте интервьюеров или добавьте ещё (до четырёх), сохраните состав и отправьте каждому
                    его персональную ссылку на заполнение протокола.
                  </p>
                </>
              )}
            </div>
          </div>
          {readOnlyHired ? null : (
            <form action={addCandidateForVacancy.bind(null, v.id)} className="flex flex-wrap gap-2">
              <input
                name="name"
                placeholder="ФИО (необязательно — укажет интервьюер)"
                className="min-w-[220px] rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-[hsl(var(--accent))]/45 focus:ring-2 focus:ring-[hsl(var(--accent))]/18 dark:border-white/12 dark:bg-black/35"
              />
              <FormSubmitButton
                pendingLabel="Добавление…"
                className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                Добавить слот интервью
              </FormSubmitButton>
            </form>
          )}
        </div>
        <CompareCandidates
          vacancyId={v.id}
          candidates={v.candidates}
          avgByCandidateId={scoreAgg.avgByCandidateId}
          readOnly={readOnlyHired}
        />
        <CandidateSearch
          vacancyId={v.id}
          candidates={v.candidates}
          blockCount={v.blocks.length}
          avgByCandidateId={scoreAgg.avgByCandidateId}
        />
      </section>

      {readOnlyHired ? null : (
        <form action={removeVacancyAndRedirect.bind(null, v.id)}>
          <FormSubmitButton
            pendingLabel="Удаление…"
            className="text-sm font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
          >
            Удалить вакансию
          </FormSubmitButton>
        </form>
      )}
    </div>
  );
}
