"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import { duplicateVacancy } from "@/actions/vacancies";
import { runCompareAllCandidatesAI, runGeneratePlanAI } from "@/actions/ai-run";
import {
  importQuestionBankQuestionIds,
  movePlanQuestion,
  reorderPlanBlocks,
} from "@/actions/plan";
import { getQuestionBankCatalog, type QuestionBankCatalogBlock } from "@/actions/question-bank";
import type { VacancyWithRelations } from "@/lib/stats";
import { candidateAvgScore, candidateDisplayName, candidateReadiness } from "@/lib/stats";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical } from "lucide-react";
import Link from "next/link";

const collapseToggleClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-black/15 bg-black/[0.03] px-3.5 py-2 text-sm font-medium text-[hsl(var(--foreground))] shadow-sm transition hover:bg-black/[0.06] dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]";

const panelShellClass =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

function asUserErrorMessage(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

const PLAN_BLOCK_DND_MIME = "application/x-plan-block-id";

/** Вставить draggedId перед или после targetId (после удаления dragged из списка). */
function reorderBlockIdsWithPlace(
  order: string[],
  draggedId: string,
  targetId: string,
  place: "before" | "after",
): string[] {
  if (draggedId === targetId) return order;
  const filtered = order.filter((id) => id !== draggedId);
  let insertAt = filtered.indexOf(targetId);
  if (insertAt < 0) return order;
  if (place === "after") insertAt += 1;
  const next = [...filtered];
  next.splice(insertAt, 0, draggedId);
  return next;
}

type PlanBlocksCtx = { activeId: string; setActiveId: (id: string) => void; multi: boolean };

const PlanBlocksContext = createContext<PlanBlocksCtx | null>(null);

/** Табы слева + опциональный футер сайдбара (например «Добавить блок»). */
export function InterviewPlanBlocksNavigator({
  vacancyId,
  blockTabs,
  sidebarFooter,
  children,
}: {
  vacancyId?: string;
  blockTabs: { id: string; title: string }[];
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [dndPending, startDnd] = useTransition();
  const [dndErr, setDndErr] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: string;
    place: "before" | "after";
  } | null>(null);
  const dropIndicatorRef = useRef<{ targetId: string; place: "before" | "after" } | null>(null);
  const [activeId, setActiveId] = useState(blockTabs[0]?.id ?? "");
  const multi = blockTabs.length > 1;
  const canDragBlocks = Boolean(vacancyId) && multi;
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
    `flex min-w-0 flex-1 items-start gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors ${
      active
        ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/12 font-medium text-[hsl(var(--accent))] shadow-sm"
        : "border-black/10 bg-white/60 hover:border-black/20 dark:border-white/10 dark:bg-black/20 dark:hover:border-white/20"
    }`;

  const hasSidebar = blockTabs.length > 0 || sidebarFooter != null;
  const onlyNewBlockUi = blockTabs.length === 0 && sidebarFooter != null;

  const clearDropIndicator = useCallback(() => {
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }, []);

  const onDropOnRow = (targetId: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!vacancyId) return;
    const draggedId =
      e.dataTransfer.getData(PLAN_BLOCK_DND_MIME) || e.dataTransfer.getData("text/plain");
    if (!draggedId) return;
    const ind = dropIndicatorRef.current;
    const place =
      ind?.targetId === targetId ? ind.place : ("before" as const);
    clearDropIndicator();
    setDraggingBlockId(null);
    const currentIds = blockTabs.map((t) => t.id);
    const next = reorderBlockIdsWithPlace(currentIds, draggedId, targetId, place);
    if (next.join("|") === currentIds.join("|")) return;
    setDndErr(null);
    startDnd(async () => {
      const r = await reorderPlanBlocks(vacancyId, next);
      if (r && "error" in r && r.error) {
        setDndErr(typeof r.error === "string" ? r.error : "Не удалось изменить порядок");
        return;
      }
      router.refresh();
    });
  };

  return (
    <PlanBlocksContext.Provider value={{ activeId, setActiveId, multi }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {hasSidebar ? (
          <aside
            className={`flex w-full shrink-0 flex-col gap-3 lg:min-w-0 ${onlyNewBlockUi ? "lg:w-full lg:max-w-md" : "lg:w-72 xl:w-80"}`}
            aria-label="Блоки плана"
          >
            {blockTabs.length > 0 ? (
              <div className="overflow-visible rounded-xl border border-black/10 bg-gradient-to-b from-black/[0.03] to-transparent p-3 dark:border-white/10 dark:from-white/[0.04]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">Блоки плана</p>
                {canDragBlocks ? (
                  <p className="mt-1 text-[10px] leading-snug text-[hsl(var(--muted))]">
                    Порядок: перетащите строку; цветная черта показывает, куда встанет блок (выше/ниже строки).
                  </p>
                ) : null}
                {dndErr ? <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">{dndErr}</p> : null}
                <div
                  className="mt-2 flex flex-col gap-1.5 overflow-visible"
                  role="tablist"
                  aria-label="Переключение блоков плана"
                  onDragLeave={(ev) => {
                    if (!canDragBlocks || !draggingBlockId) return;
                    const el = ev.currentTarget;
                    const rel = ev.relatedTarget as Node | null;
                    if (rel && el.contains(rel)) return;
                    clearDropIndicator();
                  }}
                >
                  {blockTabs.map((b, i) => {
                    const lineBefore =
                      draggingBlockId &&
                      draggingBlockId !== b.id &&
                      dropIndicator?.targetId === b.id &&
                      dropIndicator.place === "before";
                    const lineAfter =
                      draggingBlockId &&
                      draggingBlockId !== b.id &&
                      dropIndicator?.targetId === b.id &&
                      dropIndicator.place === "after";
                    const lineClass =
                      "pointer-events-none absolute left-1 right-1 z-10 h-[3px] rounded-full bg-[hsl(var(--accent))] shadow-[0_0_0_1px_hsl(var(--accent)/0.25)] dark:shadow-[0_0_0_1px_hsl(var(--accent)/0.35)]";
                    return (
                    <div
                      key={b.id}
                      className={`relative rounded-lg ${dndPending ? "opacity-70" : ""} ${draggingBlockId === b.id ? "opacity-60" : ""}`}
                      onDragOver={(ev) => {
                        if (!canDragBlocks || !draggingBlockId) return;
                        ev.preventDefault();
                        ev.dataTransfer.dropEffect = "move";
                        if (draggingBlockId === b.id) {
                          clearDropIndicator();
                          return;
                        }
                        const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const place = ev.clientY < rect.top + rect.height / 2 ? "before" : "after";
                        dropIndicatorRef.current = { targetId: b.id, place };
                        setDropIndicator((prev) =>
                          prev?.targetId === b.id && prev.place === place ? prev : { targetId: b.id, place },
                        );
                      }}
                      onDrop={(ev) => onDropOnRow(b.id, ev)}
                    >
                      {lineBefore ? <div className={`${lineClass} -top-1.5`} aria-hidden /> : null}
                      {lineAfter ? <div className={`${lineClass} -bottom-1.5`} aria-hidden /> : null}
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeId === b.id}
                        aria-controls={`plan-block-panel-${b.id}`}
                        id={`plan-block-tab-${b.id}`}
                        draggable={canDragBlocks}
                        onDragStart={(ev) => {
                          if (!canDragBlocks) return;
                          ev.dataTransfer.setData(PLAN_BLOCK_DND_MIME, b.id);
                          ev.dataTransfer.setData("text/plain", b.id);
                          ev.dataTransfer.effectAllowed = "move";
                          setDraggingBlockId(b.id);
                          clearDropIndicator();
                        }}
                        onDragEnd={() => {
                          setDraggingBlockId(null);
                          clearDropIndicator();
                        }}
                        title={canDragBlocks ? "Перетащите строку, чтобы изменить порядок блоков" : undefined}
                        onClick={() => setActiveId(b.id)}
                        className={`${tabBtn(activeId === b.id)} ${canDragBlocks ? "w-full cursor-grab touch-manipulation select-none active:cursor-grabbing" : "w-full"}`}
                      >
                        {canDragBlocks ? (
                          <span
                            className="mt-0.5 shrink-0 text-[hsl(var(--muted))]"
                            aria-hidden
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        ) : null}
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold dark:bg-white/15">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 whitespace-normal break-words [overflow-wrap:anywhere] text-left">
                          {b.title.trim() || "Без названия"}
                        </span>
                      </button>
                    </div>
                    );
                  })}
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

export function VacancyParamsCollapse({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  /** Например, при закрытии с наймом — сразу показать параметры в режиме просмотра. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
          <GeneratePlanButton vacancyId={vacancyId} onSuccess={() => setOpen(true)} />
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

function blockCheckboxState(block: QuestionBankCatalogBlock, picked: Record<string, boolean>) {
  const qs = block.questions;
  if (qs.length === 0) return { checked: false, indeterminate: false };
  const n = qs.filter((q) => picked[q.id]).length;
  if (n === 0) return { checked: false, indeterminate: false };
  if (n === qs.length) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

export function QuestionBankButton({ vacancyId }: { vacancyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<QuestionBankCatalogBlock[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setPicked({});
    setLoadErr(null);
    setErr(null);
    setBlocks(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingCatalog(true);
    setBlocks(null);
    void (async () => {
      try {
        const list = await getQuestionBankCatalog();
        if (cancelled) return;
        setBlocks(list);
        setLoadErr(null);
        const ex: Record<string, boolean> = {};
        for (const b of list) ex[b.id] = true;
        setExpanded(ex);
      } catch {
        if (!cancelled) setLoadErr("Не удалось загрузить банк.");
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggleQuestion = (qid: string) => setPicked((p) => ({ ...p, [qid]: !p[qid] }));

  const toggleBlockAll = (block: QuestionBankCatalogBlock) => {
    const allOn = block.questions.length > 0 && block.questions.every((q) => picked[q.id]);
    setPicked((p) => {
      const next = { ...p };
      for (const q of block.questions) {
        next[q.id] = !allOn;
      }
      return next;
    });
  };

  const pickedIds = Object.entries(picked)
    .filter(([, v]) => v)
    .map(([id]) => id);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErr(null);
          setLoadErr(null);
        }}
        className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/10"
      >
        Банк вопросов
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-bank-title"
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-[hsl(var(--surface))] shadow-xl dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-black/10 px-4 py-3 dark:border-white/10">
              <h3 id="question-bank-title" className="text-base font-semibold">
                Банк вопросов
              </h3>
              <p className="mt-1 text-xs text-[hsl(var(--muted))]">
                Типовые блоки и формулировки для интервью. Отметьте вопросы и добавьте их в конец плана вакансии.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {loadErr ? <p className="text-sm text-red-600 dark:text-red-400">{loadErr}</p> : null}
              {!loadErr && loadingCatalog ? (
                <p className="text-sm text-[hsl(var(--muted))]">Загрузка…</p>
              ) : null}
              {!loadingCatalog && !loadErr && blocks && blocks.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted))]">В банке пока нет шаблонов. Запустите миграции и seed.</p>
              ) : null}
              {blocks && blocks.length > 0 ? (
                <ul className="space-y-2">
                  {blocks.map((b) => {
                    const { checked, indeterminate } = blockCheckboxState(b, picked);
                    const isOpen = expanded[b.id] !== false;
                    return (
                      <li key={b.id} className="rounded-xl border border-black/10 dark:border-white/10">
                        <div className="flex flex-wrap items-start gap-2 border-b border-black/5 px-3 py-2.5 dark:border-white/10">
                          <input
                            type="checkbox"
                            checked={checked}
                            ref={(el) => {
                              if (el) el.indeterminate = indeterminate;
                            }}
                            onChange={() => toggleBlockAll(b)}
                            className="mt-1"
                            aria-label={`Выбрать все вопросы блока «${b.title}»`}
                          />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setExpanded((ex) => ({ ...ex, [b.id]: !isOpen }))}
                          >
                            <span className="font-medium">{b.title}</span>
                            {b.required ? (
                              <span className="ml-2 text-xs text-[hsl(var(--muted))]">обязательный в шаблоне</span>
                            ) : null}
                            <span className="ml-2 text-xs text-[hsl(var(--muted))]">
                              {isOpen ? "▼" : "▶"} {b.questions.length} вопр.
                            </span>
                          </button>
                        </div>
                        {isOpen ? (
                          <ul className="space-y-0 divide-y divide-black/5 dark:divide-white/10">
                            {b.questions.map((q) => (
                              <li key={q.id}>
                                <label className="flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                                  <input
                                    type="checkbox"
                                    checked={!!picked[q.id]}
                                    onChange={() => toggleQuestion(q.id)}
                                    className="mt-1 shrink-0"
                                  />
                                  <span className="min-w-0 text-sm leading-snug">{q.text}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            {err ? <p className="shrink-0 px-4 text-xs text-red-600 dark:text-red-400">{err}</p> : null}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-black/10 px-4 py-3 dark:border-white/10">
              <span className="text-xs text-[hsl(var(--muted))]">Выбрано вопросов: {pickedIds.length}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => close()}
                  className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={pending || pickedIds.length === 0}
                  onClick={() => {
                    setErr(null);
                    start(async () => {
                      const r = await importQuestionBankQuestionIds(vacancyId, pickedIds);
                      if ("error" in r) setErr(asUserErrorMessage(r.error, "Ошибка"));
                      else {
                        close();
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
        </div>
      ) : null}
    </>
  );
}

export function PlanQuestionReorderButtons({
  vacancyId,
  questionId,
  questionIndex,
  totalInBlock,
}: {
  vacancyId: string;
  questionId: string;
  questionIndex: number;
  totalInBlock: number;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isFirst = questionIndex <= 0;
  const isLast = questionIndex >= totalInBlock - 1;

  const move = (direction: "up" | "down") => {
    setErr(null);
    start(async () => {
      const r = await movePlanQuestion(questionId, vacancyId, direction);
      if (r && "error" in r && r.error) {
        setErr(typeof r.error === "string" ? r.error : "Не удалось переместить");
        return;
      }
      router.refresh();
    });
  };

  const btnClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white/90 text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--accent))]/40 hover:bg-[hsl(var(--accent))]/10 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/12 dark:bg-black/30 dark:hover:bg-[hsl(var(--accent))]/15 sm:h-9 sm:w-9";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pending || isFirst}
          onClick={() => move("up")}
          className={btnClass}
          title="Переместить вопрос выше в блоке"
          aria-label="Переместить вопрос выше в блоке"
        >
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          onClick={() => move("down")}
          className={btnClass}
          title="Переместить вопрос ниже в блоке"
          aria-label="Переместить вопрос ниже в блоке"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {err ? <p className="max-w-[14rem] text-right text-[10px] text-red-600 dark:text-red-400">{err}</p> : null}
    </div>
  );
}

export function GeneratePlanButton({
  vacancyId,
  onSuccess,
}: {
  vacancyId: string;
  onSuccess?: () => void;
}) {
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
              onSuccess?.();
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
  const [dupErr, setDupErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
      type="button"
      disabled={pending}
      onClick={() => {
        setDupErr(null);
        start(async () => {
          const r = await duplicateVacancy(vacancyId);
          if ("error" in r && r.error) {
            setDupErr(r.error);
            return;
          }
          if ("ok" in r && r.ok && r.id) router.push(`/vacancies/${r.id}`);
          else router.refresh();
        });
      }}
      className="rounded-xl border border-black/10 bg-white/80 px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-60 dark:border-white/12 dark:bg-black/40 dark:hover:bg-black/50"
    >
      {pending ? "Копия…" : "Дублировать вакансию"}
    </button>
      {dupErr ? <p className="max-w-xs text-xs text-red-600 dark:text-red-400">{dupErr}</p> : null}
    </div>
  );
}

export function CandidateSearch({
  vacancyId,
  candidates,
  blockCount,
  avgByCandidateId = {},
}: {
  vacancyId: string;
  candidates: VacancyWithRelations["candidates"];
  blockCount: number;
  /** Средний балл по общим оценкам блоков; считается на сервере запросом к БД (надёжнее, чем вложенный include в props). */
  avgByCandidateId?: Record<string, number>;
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
          const avg = avgByCandidateId[c.id] ?? candidateAvgScore(c);
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
  avgByCandidateId = {},
  readOnly = false,
}: {
  vacancyId: string;
  candidates: VacancyWithRelations["candidates"];
  avgByCandidateId?: Record<string, number>;
  /** Скрыть блок сравнения ИИ (режим только просмотра). */
  readOnly?: boolean;
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

  if (readOnly) return null;
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
        подходит.
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
                          Средний балл: {avgByCandidateId[c.id] ?? candidateAvgScore(c) ?? "—"}
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
