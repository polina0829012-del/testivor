"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { duplicateVacancy } from "@/actions/vacancies";
import { runCompareAllCandidatesAI, runGeneratePlanAI } from "@/actions/ai-run";
import { importQuestionBankBlocks } from "@/actions/plan";
import { QUESTION_BANK_BLOCKS } from "@/lib/question-bank";
import type { VacancyWithRelations } from "@/lib/stats";
import { candidateAvgScore, candidateDisplayName, candidateReadiness } from "@/lib/stats";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import Link from "next/link";

const collapseToggleClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-black/15 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-[hsl(var(--foreground))] shadow-sm transition hover:bg-black/[0.06] dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]";

const panelShellClass =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

function asUserErrorMessage(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

type PlanBlocksCtx = { activeId: string; setActiveId: (id: string) => void; multi: boolean };

const PlanBlocksContext = createContext<PlanBlocksCtx | null>(null);

/** Табы слева + опциональный футер сайдбара (например «Добавить блок»). */
export function InterviewPlanBlocksNavigator({
  blockTabs,
  sidebarFooter,
  children,
}: {
  blockTabs: { id: string; title: string }[];
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState(blockTabs[0]?.id ?? "");
  const multi = blockTabs.length > 1;
  const tabIdsKey = useMemo(() => blockTabs.map((b) => b.id).join("|"), [blockTabs]);
  const blockTabsRef = useRef(blockTabs);
  blockTabsRef.current = blockTabs;

  useEffect(() => {
    const tabs = blockTabsRef.current;
    if (tabs.length === 0) return;
    if (!tabs.some((b) => b.id === activeId)) {
      setActiveId(tabs[0].id);
    }
  }, [tabIdsKey, activeId]);

  const idx = blockTabs.findIndex((b) => b.id === activeId);
  const safeIdx = idx >= 0 ? idx : 0;
  const current = safeIdx + 1;
  const tabBtn = (active: boolean) =>
    `flex w-full items-start gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors ${
      active
        ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/12 font-medium text-[hsl(var(--accent))] shadow-sm"
        : "border-black/10 bg-white/60 hover:border-black/20 dark:border-white/10 dark:bg-black/20 dark:hover:border-white/20"
    }`;

  const hasSidebar = blockTabs.length > 0 || sidebarFooter != null;
  const onlyNewBlockUi = blockTabs.length === 0 && sidebarFooter != null;

  return (
    <PlanBlocksContext.Provider value={{ activeId, setActiveId, multi }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {hasSidebar ? (
          <aside
            className={`flex w-full shrink-0 flex-col gap-3 lg:min-w-0 ${onlyNewBlockUi ? "lg:w-full lg:max-w-md" : "lg:w-72 xl:w-80"}`}
            aria-label="Блоки плана"
          >
            {blockTabs.length > 0 ? (
              <div className="rounded-xl border border-black/10 bg-gradient-to-b from-black/[0.03] to-transparent p-3 dark:border-white/10 dark:from-white/[0.04]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">Блоки плана</p>
                <div className="mt-2 flex flex-col gap-1.5" role="tablist" aria-label="Переключение блоков плана">
                  {blockTabs.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      role="tab"
                      aria-selected={activeId === b.id}
                      aria-controls={`plan-block-panel-${b.id}`}
                      id={`plan-block-tab-${b.id}`}
                      onClick={() => setActiveId(b.id)}
                      className={tabBtn(activeId === b.id)}
                    >
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold dark:bg-white/15">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words [overflow-wrap:anywhere]">
                        {b.title.trim() || "Без названия"}
                      </span>
                    </button>
                  ))}
                </div>
                {multi ? (
                  <div className="mt-3 space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
                    <span className="text-xs text-[hsl(var(--muted))]">
                      Блок <span className="font-semibold text-[hsl(var(--foreground))]">{current}</span> из{" "}
                      {blockTabs.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={safeIdx <= 0}
                        onClick={() => setActiveId(blockTabs[safeIdx - 1].id)}
                        className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-lg border border-black/10 px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                        Назад
                      </button>
                      <button
                        type="button"
                        disabled={safeIdx >= blockTabs.length - 1}
                        onClick={() => setActiveId(blockTabs[safeIdx + 1].id)}
                        className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-lg border border-black/10 px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15"
                      >
                        Далее
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {sidebarFooter ? (
              <div
                className={
                  onlyNewBlockUi
                    ? "rounded-2xl border border-[hsl(var(--accent))]/25 bg-gradient-to-br from-[hsl(var(--accent))]/[0.1] via-[hsl(var(--surface))] to-[hsl(var(--surface))] p-5 shadow-sm ring-1 ring-black/[0.04] dark:border-[hsl(var(--accent))]/30 dark:from-[hsl(var(--accent))]/15 dark:ring-white/[0.06] sm:p-6"
                    : "rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10"
                }
              >
                {sidebarFooter}
              </div>
            ) : null}
          </aside>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PlanBlocksContext.Provider>
  );
}

/** Один блок плана: при нескольких блоках показывается только активный. */
export function PlanBlockPanel({ blockId, children }: { blockId: string; children: ReactNode }) {
  const ctx = useContext(PlanBlocksContext);
  const multi = ctx?.multi ?? false;
  const visible = !multi || ctx?.activeId === blockId;
  return (
    <div
      role={multi ? "tabpanel" : undefined}
      id={`plan-block-panel-${blockId}`}
      aria-labelledby={multi ? `plan-block-tab-${blockId}` : undefined}
      hidden={!visible}
      className={visible ? "block" : "hidden"}
    >
      {children}
    </div>
  );
}

export function VacancyParamsCollapse({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={panelShellClass}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold leading-tight tracking-tight">Параметры вакансии</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={collapseToggleClass}
          aria-expanded={open}
          aria-controls="vacancy-params-panel"
          id="vacancy-params-toggle"
        >
          {open ? (
            <>
              Скрыть
              <ChevronUp className="h-4 w-4 opacity-80" strokeWidth={2.25} aria-hidden />
            </>
          ) : (
            <>
              Показать
              <ChevronDown className="h-4 w-4 opacity-80" strokeWidth={2.25} aria-hidden />
            </>
          )}
        </button>
      </div>
      {open ? (
        <div
          id="vacancy-params-panel"
          role="region"
          aria-labelledby="vacancy-params-toggle"
          className="mt-4 border-t border-black/10 pt-4 dark:border-white/10"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function InterviewPlanSection({
  vacancyId,
  hasExistingBlocks,
  children,
}: {
  vacancyId: string;
  hasExistingBlocks: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggleLabel = open ? (
    <>
      Скрыть
      <ChevronUp className="h-4 w-4 opacity-80" strokeWidth={2.25} aria-hidden />
    </>
  ) : (
    <>
      Показать
      <ChevronDown className="h-4 w-4 opacity-80" strokeWidth={2.25} aria-hidden />
    </>
  );
  return (
    <section className={panelShellClass}>
      <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-3 sm:gap-y-0">
        <h2 className="col-start-1 row-start-1 text-base font-semibold leading-tight tracking-tight">План интервью</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${collapseToggleClass} col-start-2 row-start-1 justify-self-end sm:col-start-3`}
          aria-expanded={open}
          aria-controls="interview-plan-panel"
          id="interview-plan-toggle"
        >
          {toggleLabel}
        </button>
        <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-center">
          <QuestionBankButton vacancyId={vacancyId} />
          <GeneratePlanButton vacancyId={vacancyId} />
        </div>
      </div>
      {open ? (
        <div
          id="interview-plan-panel"
          role="region"
          aria-labelledby="interview-plan-toggle"
          className="mt-4 border-t border-black/10 pt-4 dark:border-white/10"
        >
          <p className="mb-3 text-xs text-[hsl(var(--muted))]">
            {hasExistingBlocks
              ? "Если план уже есть — ИИ предложит только новые блоки в конец. Целиком заменить план можно только при пустом плане."
              : "Пустой план: ИИ создаст блоки с нуля. Если уже есть протоколы с оценками — план нельзя заменить целиком (защита данных)."}
          </p>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function QuestionBankButton({ vacancyId }: { vacancyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErr(null);
        }}
        className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/10"
      >
        Банк вопросов
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-bank-title"
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-[hsl(var(--surface))] shadow-xl dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
              <h3 id="question-bank-title" className="text-base font-semibold">
                Банк вопросов
              </h3>
              <p className="mt-1 text-xs text-[hsl(var(--muted))]">
                Отметьте стандартные блоки — они добавятся в конец плана, как в конструкторе.
              </p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
              <ul className="space-y-3">
                {QUESTION_BANK_BLOCKS.map((b) => (
                  <li key={b.id} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                    <label className="flex cursor-pointer gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected[b.id]}
                        onChange={() => toggle(b.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{b.title}</span>
                        {b.required ? (
                          <span className="ml-2 text-xs text-[hsl(var(--muted))]">обязательный</span>
                        ) : null}
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[hsl(var(--muted))]">
                          {b.questions.map((q, i) => (
                            <li key={i}>{q.text}</li>
                          ))}
                        </ul>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            {err ? <p className="px-4 text-xs text-red-600 dark:text-red-400">{err}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 px-4 py-3 dark:border-white/10">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setErr(null);
                  const ids = Object.entries(selected)
                    .filter(([, v]) => v)
                    .map(([id]) => id);
                  start(async () => {
                    const r = await importQuestionBankBlocks(vacancyId, ids);
                    if ("error" in r) setErr(asUserErrorMessage(r.error, "Ошибка"));
                    else {
                      setOpen(false);
                      setSelected({});
                      router.refresh();
                    }
                  });
                }}
                className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Добавление…" : "Добавить в план"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function GeneratePlanButton({ vacancyId }: { vacancyId: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-1 sm:items-stretch">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErr(null);
          setNotice(null);
          start(async () => {
            const r = await runGeneratePlanAI(vacancyId);
            if ("error" in r) setErr(asUserErrorMessage(r.error, "Ошибка ИИ"));
            else {
              const notice = "notice" in r ? r.notice : undefined;
              setNotice(typeof notice === "string" ? notice : null);
              router.refresh();
            }
          });
        }}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Генерация…" : "Сгенерировать план (AI)"}
      </button>
      {err ? <p className="max-w-xs text-center text-xs text-red-600 dark:text-red-400 sm:text-left">{err}</p> : null}
      {notice ? (
        <p className="max-w-xs text-center text-xs text-emerald-700 dark:text-emerald-400 sm:text-left">{notice}</p>
      ) : null}
    </div>
  );
}

export function DuplicateVacancyButton({ vacancyId }: { vacancyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await duplicateVacancy(vacancyId);
          if ("ok" in r && r.ok && r.id) router.push(`/vacancies/${r.id}`);
          else router.refresh();
        });
      }}
      className="rounded-xl border border-black/10 bg-white/80 px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-60 dark:border-white/12 dark:bg-black/40 dark:hover:bg-black/50"
    >
      {pending ? "Копия…" : "Дублировать вакансию"}
    </button>
  );
}

export function CandidateSearch({
  vacancyId,
  candidates,
  blockCount,
}: {
  vacancyId: string;
  candidates: VacancyWithRelations["candidates"];
  blockCount: number;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return candidates;
    return candidates.filter((c) => candidateDisplayName(c.name).toLowerCase().includes(s));
  }, [candidates, q]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск кандидата…"
        className="w-full max-w-md rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
      />
      <ul className="space-y-2">
        {filtered.map((c) => {
          const avg = candidateAvgScore(c);
          const r = candidateReadiness(c, blockCount);
          return (
            <li
              key={c.id}
              className="flex flex-col gap-1 rounded-xl border border-black/10 bg-[hsl(var(--surface))] px-4 py-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link href={`/vacancies/${vacancyId}/candidates/${c.id}`} className="font-medium text-[hsl(var(--accent))]">
                  {candidateDisplayName(c.name)}
                </Link>
                <p className="text-xs text-[hsl(var(--muted))]">
                  Протоколы: {r.done}/{r.total}
                  {r.complete ? " · готово" : ""}
                  {avg != null ? ` · средний балл ${avg}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type CompareAiRow = {
  candidateId: string;
  brief: string;
  strengths: string;
  risks: string;
};

type CompareAiData = {
  rows: CompareAiRow[];
  rankingIds: string[];
  topCandidateId: string | null;
  recommendation: string;
};

export function CompareCandidates({
  vacancyId,
  candidates,
}: {
  vacancyId: string;
  candidates: VacancyWithRelations["candidates"];
}) {
  const [data, setData] = useState<CompareAiData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of candidates) {
      m.set(c.id, candidateDisplayName(c.name));
    }
    return m;
  }, [candidates]);

  if (candidates.length < 2) return null;

  const rowById = new Map((data?.rows ?? []).map((r) => [r.candidateId, r]));

  const rankingOrdered = (() => {
    const seen = new Set<string>();
    const ordered: { id: string; name: string }[] = [];
    for (const id of data?.rankingIds ?? []) {
      if (!candidates.some((c) => c.id === id) || seen.has(id)) continue;
      seen.add(id);
      ordered.push({ id, name: nameById.get(id) ?? id });
    }
    for (const c of candidates) {
      if (!seen.has(c.id)) ordered.push({ id: c.id, name: nameById.get(c.id) ?? c.id });
    }
    return ordered;
  })();

  return (
    <div className="rounded-lg border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
      <h3 className="text-base font-semibold">Сравнение кандидатов</h3>
      <p className="mt-1 text-[11px] text-[hsl(var(--muted))] leading-snug">
        ИИ анализирует протоколы всех кандидатов на эту вакансию, строит сводную таблицу и даёт рекомендацию, кто лучше
        подходит. Нужен настроенный API к модели (OPENAI_API_KEY).
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErr(null);
          setData(null);
          start(async () => {
            const r = await runCompareAllCandidatesAI(vacancyId);
            if ("error" in r) {
              setErr(asUserErrorMessage(r.error, "Ошибка"));
              return;
            }
            if ("ok" in r && r.ok && r.data) {
              setData(r.data as CompareAiData);
            }
          });
        }}
        className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Анализ…" : "Сравнить всех (AI)"}
      </button>
      {err ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</p> : null}

      {data ? (
        <div className="mt-4 space-y-4">
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.05]">
                  <th className="px-3 py-2 font-semibold">Кандидат</th>
                  <th className="px-3 py-2 font-semibold">Кратко</th>
                  <th className="px-3 py-2 font-semibold">Сильные стороны</th>
                  <th className="px-3 py-2 font-semibold">Риски / вопросы</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const row = rowById.get(c.id);
                  const isTop = data.topCandidateId === c.id;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-black/5 last:border-0 dark:border-white/10 ${
                        isTop ? "bg-violet-500/10 dark:bg-violet-500/15" : ""
                      }`}
                    >
                      <td className="align-top px-3 py-2">
                        <Link href={`/vacancies/${vacancyId}/candidates/${c.id}`} className="font-medium text-[hsl(var(--accent))] hover:underline">
                          {nameById.get(c.id)}
                        </Link>
                        {isTop ? (
                          <span className="mt-1 block text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">
                            Предпочтительнее (по мнению ИИ)
                          </span>
                        ) : null}
                        <p className="mt-1 text-xs text-[hsl(var(--muted))]">
                          Средний балл: {candidateAvgScore(c) ?? "—"}
                        </p>
                      </td>
                      <td className="align-top px-3 py-2 text-[hsl(var(--foreground))]">{row?.brief ?? "—"}</td>
                      <td className="align-top px-3 py-2 text-[hsl(var(--foreground))]">{row?.strengths ?? "—"}</td>
                      <td className="align-top px-3 py-2 text-[hsl(var(--foreground))]">{row?.risks ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Ранжирование (лучше → слабее)</h4>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {rankingOrdered.map(({ id, name }) => (
                <li key={id}>
                  <Link href={`/vacancies/${vacancyId}/candidates/${id}`} className="text-[hsl(var(--accent))] hover:underline">
                    {name}
                  </Link>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/25">
            <h4 className="text-sm font-semibold text-violet-900 dark:text-violet-200">Рекомендация ИИ</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{data.recommendation}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
