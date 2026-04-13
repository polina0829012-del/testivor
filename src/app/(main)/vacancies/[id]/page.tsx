import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronLeft } from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { vacancyKpi } from "@/lib/stats";
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
  VacancyParamsCollapse,
} from "./vacancy-client";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]/45 focus:ring-2 focus:ring-[hsl(var(--accent))]/18 dark:border-white/12 dark:bg-black/35 dark:focus:border-[hsl(var(--accent))]/40";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]";

const candidatesPanelClass =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

export default async function VacancyPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const v = await prisma.vacancy.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
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

  const kpi = vacancyKpi(v);
  const planSaveFormId = `interview-plan-save-${v.id}`;

  return (
    <div className="w-full space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-br from-[hsl(var(--accent))]/[0.12] via-[hsl(var(--surface))] to-[hsl(var(--surface))] p-6 shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:from-[hsl(var(--accent))]/15 dark:ring-white/[0.06] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[hsl(var(--accent))]/10 blur-3xl dark:bg-[hsl(var(--accent))]/20" />
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
            <DuplicateVacancyButton vacancyId={v.id} />
          </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi title="Кандидаты" value={String(kpi.candidateCount)} />
        <Kpi title="С расхождениями" value={String(kpi.withDiscrepancies)} />
        <Kpi
          title="Средний балл (по кандидатам)"
          value={kpi.avgScoreAcrossCandidates != null ? String(kpi.avgScoreAcrossCandidates) : "—"}
        />
      </section>

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
              <option value="closed">Закрыта</option>
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
                Единое описание для рекрутера, карточки и ИИ (старые данные из отдельного поля подставлены ниже при первом
                открытии — после сохранения всё хранится здесь).
              </p>
              <textarea
                name="competencies"
                defaultValue={mergedVacancyProfile(v.competencies, v.expectationsForCandidate)}
                required
                rows={6}
                className={`${fieldClass} mt-2 bg-white/90 dark:bg-black/40`}
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
            <button
              type="submit"
              className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-black"
            >
              Сохранить
            </button>
          </div>
        </form>
      </VacancyParamsCollapse>

      <InterviewPlanSection vacancyId={v.id} hasExistingBlocks={v.blocks.length > 0}>
        <InterviewPlanBlocksNavigator
          blockTabs={v.blocks.map((b) => ({ id: b.id, title: b.title }))}
          sidebarFooter={
            <>
              <p className="text-base font-semibold tracking-tight">Добавить первый блок</p>
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
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[hsl(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  Добавить блок
                </button>
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
                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <form action={submitToggleRequired}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <button
                          type="submit"
                          className={
                            block.required
                              ? "rounded-lg border border-emerald-600/80 bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                              : "rounded-lg border border-amber-400/90 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-sm hover:bg-amber-100 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                          }
                        >
                          {block.required ? "Обязательный ✓" : "Сделать обязательным"}
                        </button>
                      </form>
                      <form action={submitAddQuestion}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <button type="submit" className="rounded-lg border border-black/12 bg-white/80 px-3 py-2 text-sm dark:border-white/12 dark:bg-black/25">
                          + Вопрос
                        </button>
                      </form>
                      <form action={submitDeleteBlock}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200/90 bg-red-50/50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                        >
                          Удалить блок
                        </button>
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
                              <form action={submitDeleteQuestion} className="flex shrink-0 items-start pt-1 sm:pt-0.5">
                                <input type="hidden" name="questionId" value={q.id} />
                                <input type="hidden" name="vacancyId" value={v.id} />
                                <button
                                  type="submit"
                                  className="rounded-md px-2 py-1 text-sm text-red-600 underline-offset-2 hover:underline dark:text-red-400"
                                >
                                  Удалить
                                </button>
                              </form>
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
          Добавление, удаление и обязательность — сразу по своим кнопкам.
        </p>
        <form id={planSaveFormId} action={submitSaveInterviewPlan.bind(null, v.id)} className="mt-3">
          <button
            type="submit"
            className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-black"
          >
            Сохранить план
          </button>
        </form>
      </InterviewPlanSection>

      <section className={`${candidatesPanelClass} space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Кандидаты</h2>
            <p className="mt-1 max-w-xl text-xs leading-snug text-[hsl(var(--muted))]">
              ФИО можно не вводить: интервьюер укажет его при отправке протокола — имя сохранится в карточке.
            </p>
          </div>
          <form action={addCandidateForVacancy.bind(null, v.id)} className="flex flex-wrap gap-2">
            <input
              name="name"
              placeholder="ФИО (необязательно — укажет интервьюер)"
              className="min-w-[220px] rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-[hsl(var(--accent))]/45 focus:ring-2 focus:ring-[hsl(var(--accent))]/18 dark:border-white/12 dark:bg-black/35"
            />
            <button
              type="submit"
              className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Добавить слот интервью
            </button>
          </form>
        </div>
        <CandidateSearch vacancyId={v.id} candidates={v.candidates} blockCount={v.blocks.length} />
        <CompareCandidates vacancyId={v.id} candidates={v.candidates} />
      </section>

      <form action={removeVacancyAndRedirect.bind(null, v.id)}>
        <button type="submit" className="text-sm text-red-600 underline dark:text-red-400">
          Удалить вакансию
        </button>
      </form>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">{title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
