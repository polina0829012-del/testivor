"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { submitProtocol } from "@/actions/protocol";
import type { QuestionResponseType } from "@/lib/plan-question-types";
import { questionResponseTypeLabel } from "@/lib/plan-question-types";

type Block = {
  id: string;
  title: string;
  required: boolean;
  questions: { id: string; text: string; responseType: QuestionResponseType }[];
};

type ClientValidation =
  | { kind: "name"; error: string; blockIndex: number }
  | { kind: "required_blocks"; blockIndex: number };

function validateBeforeSubmit(fd: FormData, blocks: Block[]): ClientValidation | null {
  const name = String(fd.get("candidateName") ?? "").trim();
  if (name.length < 2) {
    return { kind: "name", error: "Укажите ФИО кандидата (минимум 2 символа).", blockIndex: 0 };
  }
  if (name.length > 200) {
    return { kind: "name", error: "Слишком длинное ФИО.", blockIndex: 0 };
  }

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (!block.required) continue;

    const overall = fd.get(`overall_${block.id}`);
    const overallNum = typeof overall === "string" ? Number(overall) : NaN;
    if (!Number.isInteger(overallNum) || overallNum < 1 || overallNum > 5) {
      return { kind: "required_blocks", blockIndex: bi };
    }
    for (const q of block.questions) {
      if (q.responseType === "rating") {
        const v = fd.get(`qScore_${q.id}`);
        const num = typeof v === "string" ? Number(v) : NaN;
        if (!Number.isInteger(num) || num < 1 || num > 5) {
          return { kind: "required_blocks", blockIndex: bi };
        }
      } else {
        const t = String(fd.get(`qText_${q.id}`) ?? "").trim();
        if (t.length < 1) {
          return { kind: "required_blocks", blockIndex: bi };
        }
      }
    }
  }
  return null;
}

export function ProtocolForm({
  token,
  blocks,
  existingByBlockId,
  existingByQuestionId,
  initialCandidateName,
  vacancyProfileText,
}: {
  token: string;
  blocks: Block[];
  existingByBlockId: Record<string, { notes: string; overallScore?: number } | undefined>;
  existingByQuestionId: Record<string, { textAnswer: string; scoreAnswer: number | null } | undefined>;
  initialCandidateName: string;
  vacancyProfileText: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [requiredBlocksModalOpen, setRequiredBlocksModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [portalReady, setPortalReady] = useState(false);
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const skipScrollOnMount = useRef(true);

  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

  const isFirst = activeBlockIndex === 0;
  const isLast = activeBlockIndex === blocks.length - 1;

  useEffect(() => {
    if (skipScrollOnMount.current) {
      skipScrollOnMount.current = false;
      return;
    }
    mainPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeBlockIndex]);

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[hsl(var(--background))] px-[max(1rem,env(safe-area-inset-left))] py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] text-center text-[hsl(var(--foreground))]"
        role="status"
        aria-live="polite"
      >
        <p className="text-lg font-semibold sm:text-2xl">Протокол успешно отправлен HR</p>
        <p className="mt-3 max-w-md text-sm text-[hsl(var(--muted))]">
          Спасибо. Можно закрыть эту вкладку — данные сохранены.
        </p>
      </div>
    );
  }

  const blockingOverlay =
    portalReady && typeof document !== "undefined" && (requiredBlocksModalOpen || error)
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={
              requiredBlocksModalOpen ? "required-blocks-dialog-title" : "protocol-form-error-title"
            }
          >
            <div className="w-full max-w-[min(100%,26rem)] rounded-2xl border border-black/10 bg-[hsl(var(--surface))] px-6 py-8 text-center shadow-2xl ring-1 ring-black/[0.06] dark:border-white/12 dark:ring-white/[0.06] sm:px-8 sm:py-9">
              {requiredBlocksModalOpen ? (
                <>
                  <p
                    id="required-blocks-dialog-title"
                    className="text-lg font-bold leading-tight tracking-tight text-[hsl(var(--foreground))] sm:text-2xl"
                  >
                    Необходимо заполнить обязательные блоки
                  </p>
                  <p className="mt-4 text-base leading-relaxed text-[hsl(var(--muted))] sm:text-[1.05rem]">
                    Переключитесь на блок с пометкой «Обязательный» в списке слева (или сверху на телефоне). Нужны общая
                    оценка блока и ответы на все вопросы в каждом обязательном разделе.
                  </p>
                </>
              ) : (
                <>
                  <p
                    id="protocol-form-error-title"
                    className="text-lg font-bold leading-tight text-red-800 dark:text-red-200 sm:text-xl"
                  >
                    Не удалось отправить протокол
                  </p>
                  <p className="mt-4 text-base leading-relaxed text-[hsl(var(--foreground))] sm:text-[1.05rem]">
                    {error}
                  </p>
                </>
              )}
              <button
                type="button"
                className="mt-8 min-h-12 w-full rounded-xl bg-[hsl(var(--accent))] px-4 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-95 active:opacity-90"
                onClick={() => {
                  setRequiredBlocksModalOpen(false);
                  setError(null);
                }}
              >
                Понятно
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {blockingOverlay}
    <form
      noValidate
      className="mt-3 flex flex-1 flex-col gap-3 pb-2 sm:mt-4 sm:gap-4 sm:pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setRequiredBlocksModalOpen(false);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const validation = validateBeforeSubmit(fd, blocks);
        if (validation) {
          setActiveBlockIndex(validation.blockIndex);
          if (validation.kind === "name") {
            setError(validation.error);
          } else {
            setRequiredBlocksModalOpen(true);
          }
          return;
        }
        startTransition(async () => {
          const result = await submitProtocol(token, fd);
          if (result && "error" in result && result.error) {
            if (result.error === "REQUIRED_BLOCKS_INCOMPLETE") {
              const firstReq = blocks.findIndex((b) => b.required);
              if (firstReq >= 0) setActiveBlockIndex(firstReq);
              setRequiredBlocksModalOpen(true);
            } else {
              setError(result.error);
            }
            return;
          }
          setSubmitted(true);
        });
      }}
    >
      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch lg:gap-5">
        <section
          className="flex min-h-0 flex-col rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 shadow-sm dark:border-white/10 sm:p-4"
          aria-labelledby="interviewer-vacancy-profile-heading"
        >
          <h2
            id="interviewer-vacancy-profile-heading"
            className="text-sm font-semibold leading-tight sm:text-base"
          >
            Компетенции и пожелания к кандидату
          </h2>
          <p className="mt-1 text-[11px] leading-snug text-[hsl(var(--muted))] sm:text-xs">
            То же описание роли, что видит HR — можно опираться при ответах.
          </p>
          <div className="mt-2 min-h-0 max-h-40 flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-black/[0.06] bg-black/[0.02] px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.03] sm:max-h-48 lg:max-h-[min(18rem,50vh)]">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--foreground))]">
              {vacancyProfileText.trim() || "—"}
            </p>
          </div>
        </section>

        <div className="flex flex-col rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10 sm:p-4">
          <label className="text-sm font-medium" htmlFor="candidateName">
            ФИО кандидата
          </label>
          <input
            id="candidateName"
            name="candidateName"
            type="text"
            minLength={2}
            maxLength={200}
            defaultValue={initialCandidateName}
            autoComplete="name"
            placeholder="Как в системе для HR"
            enterKeyHint="next"
            className="mt-2 min-h-11 w-full rounded-lg border border-black/10 px-3 py-2.5 text-base text-[hsl(var(--foreground))] dark:border-white/10 dark:bg-black/20"
          />
          <p className="mt-2 text-[11px] leading-snug text-[hsl(var(--muted))] sm:text-xs">
            Сохранится с протоколом. Если HR уже указал имя — проверьте и при необходимости исправьте.
          </p>
        </div>
      </div>

      <div className="grid flex-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(200px,280px)_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-1 lg:sticky lg:top-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">Блоки плана</p>
          <nav
            className="-mx-0.5 flex snap-x snap-mandatory flex-row gap-2 overflow-x-auto overscroll-x-contain px-0.5 pb-1 pt-0.5 [scrollbar-width:thin] lg:snap-none lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-0"
            aria-label="Блоки интервью"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {blocks.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-current={i === activeBlockIndex ? "true" : undefined}
                onClick={() => setActiveBlockIndex(i)}
                className={`min-h-[48px] min-w-[min(11rem,78vw)] shrink-0 snap-start rounded-xl border px-3 py-2.5 text-left text-sm transition-colors touch-manipulation active:opacity-90 lg:min-h-0 lg:min-w-0 lg:w-full lg:snap-none ${
                  i === activeBlockIndex
                    ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/12 font-medium text-[hsl(var(--accent))] shadow-sm"
                    : "border-black/10 bg-[hsl(var(--surface))] text-neutral-800 hover:border-black/20 dark:border-white/10 dark:text-neutral-100 dark:hover:border-white/20"
                }`}
              >
                <span className="text-xs text-[hsl(var(--muted))]">Блок {i + 1}</span>
                <span className="mt-0.5 block leading-snug [overflow-wrap:anywhere]">{b.title}</span>
                {b.required ? (
                  <span className="mt-1 inline-block text-[10px] font-medium uppercase text-amber-700 dark:text-amber-300">
                    Обязательный
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <p className="text-center text-[11px] text-[hsl(var(--muted))] lg:text-left">
            Блок {activeBlockIndex + 1} из {blocks.length}
          </p>
        </aside>

        <div ref={mainPanelRef} className="min-w-0 space-y-3">
          {blocks.map((block, blockIndex) => {
            const existing = existingByBlockId[block.id];
            const isActive = blockIndex === activeBlockIndex;

            return (
              <div key={block.id} className={isActive ? "" : "hidden"}>
                <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] dark:border-white/10">
                  <div className="border-b border-black/10 px-3 py-3 dark:border-white/10 sm:px-6 sm:py-4">
                    <h2 className="text-base font-semibold leading-snug sm:text-lg md:text-xl">{block.title}</h2>
                    {block.required ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Обязательный блок</p>
                    ) : null}
                    <p className="mt-2 hidden text-xs text-[hsl(var(--muted))] lg:block">
                      Пункты с баллами в две колонки на широком экране; на телефоне — по одному в ряд.
                    </p>
                  </div>

                  <div className="px-3 py-3 sm:px-6 sm:py-4">
                    <ol className="grid list-none gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-3">
                      {block.questions.map((q, qi) => {
                        const ex = existingByQuestionId[q.id];
                        const colSpan =
                          q.responseType === "text" ? "lg:col-span-2" : "";
                        if (q.responseType === "rating") {
                          const sc = ex?.scoreAnswer != null ? String(ex.scoreAnswer) : "";
                          return (
                            <li
                              key={q.id}
                              className={`rounded-lg border border-black/10 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.03] sm:p-3 ${colSpan}`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] font-medium text-[hsl(var(--muted))]">
                                    {qi + 1}. {questionResponseTypeLabel("rating")}
                                  </span>
                                  <p className="mt-0.5 text-sm font-medium leading-snug [overflow-wrap:anywhere]">{q.text}</p>
                                </div>
                                <div className="w-full shrink-0 sm:w-[7.5rem]">
                                  <label className="sr-only" htmlFor={`qScore_${q.id}`}>
                                    Балл 1–5 по вопросу «{q.text}»
                                  </label>
                                  <select
                                    id={`qScore_${q.id}`}
                                    name={`qScore_${q.id}`}
                                    defaultValue={sc}
                                    className="min-h-11 w-full rounded-lg border border-black/10 px-3 py-2 text-base dark:border-white/10 dark:bg-black/20"
                                  >
                                    <option value="">Балл…</option>
                                    {(["1", "2", "3", "4", "5"] as const).map((n) => (
                                      <option key={n} value={n}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </li>
                          );
                        }
                        return (
                          <li
                            key={q.id}
                            className={`rounded-lg border border-black/10 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.03] sm:p-3 ${colSpan}`}
                          >
                            <span className="text-[11px] font-medium text-[hsl(var(--muted))]">
                              {qi + 1}. {questionResponseTypeLabel("text")}
                            </span>
                            <p className="mt-0.5 text-sm font-medium leading-snug [overflow-wrap:anywhere]">{q.text}</p>
                            <label className="mt-1.5 block text-[11px] font-medium text-[hsl(var(--muted))]" htmlFor={`qText_${q.id}`}>
                              Ответ / заметки
                            </label>
                            <textarea
                              id={`qText_${q.id}`}
                              name={`qText_${q.id}`}
                              rows={3}
                              defaultValue={ex?.textAnswer ?? ""}
                              className="mt-1 min-h-[5.5rem] w-full resize-y rounded-lg border border-black/10 px-3 py-2.5 text-base leading-snug dark:border-white/10 dark:bg-black/20"
                            />
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  <div className="border-t border-black/10 px-3 py-4 dark:border-white/10 sm:px-6 sm:py-5">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                      <div>
                        <p className="text-sm font-semibold tracking-tight text-[hsl(var(--foreground))]">
                          Общая оценка блока
                        </p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(var(--muted))] sm:text-xs">
                          Итог по разделу целиком (1–5). Учитывается при сравнении протоколов и в анализе расхождений.
                        </p>
                      </div>
                      <fieldset className="m-0 flex flex-wrap items-center justify-center gap-2 border-0 p-0">
                        <legend className="sr-only">Общая оценка блока, балл от 1 до 5</legend>
                        {([1, 2, 3, 4, 5] as const).map((n) => (
                          <label
                            key={n}
                            className="cursor-pointer touch-manipulation select-none active:scale-[0.97]"
                          >
                            <input
                              type="radio"
                              name={`overall_${block.id}`}
                              value={String(n)}
                              defaultChecked={
                                existing?.overallScore != null && existing.overallScore === n
                              }
                              required={block.required && n === 1}
                              className="peer sr-only"
                            />
                            <span className="inline-flex h-12 min-w-[3rem] items-center justify-center rounded-2xl border border-black/10 bg-gradient-to-b from-white to-black/[0.02] px-3.5 text-base font-bold tabular-nums text-[hsl(var(--foreground))] shadow-sm ring-1 ring-black/[0.04] transition hover:border-[hsl(var(--accent))]/35 hover:shadow-md dark:border-white/12 dark:from-white/[0.06] dark:to-transparent dark:ring-white/[0.06] dark:hover:border-[hsl(var(--accent))]/50 peer-checked:border-[hsl(var(--accent))] peer-checked:bg-[hsl(var(--accent))] peer-checked:text-white peer-checked:shadow-md peer-checked:ring-[hsl(var(--accent))]/25 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[hsl(var(--accent))]/45 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[hsl(var(--background))]">
                              {n}
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    </div>
                  </div>

                  <div className="border-t border-black/10 px-3 py-3 dark:border-white/10 sm:px-6 sm:py-4">
                    <label className="text-sm font-medium" htmlFor={`notes_${block.id}`}>
                      Заметки по блоку (необязательно)
                    </label>
                    <textarea
                      id={`notes_${block.id}`}
                      name={`notes_${block.id}`}
                      rows={2}
                      defaultValue={existing?.notes ?? ""}
                      placeholder="Общие впечатления по разделу, контекст для HR"
                      className="mt-1.5 min-h-[4.5rem] w-full resize-y rounded-lg border border-black/10 px-3 py-2.5 text-base dark:border-white/10 dark:bg-black/20"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10 sm:pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => setActiveBlockIndex((i) => Math.max(0, i - 1))}
                className="min-h-12 w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-medium touch-manipulation active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 sm:min-h-0 sm:w-auto sm:py-2.5"
              >
                ← Назад
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={() => setActiveBlockIndex((i) => Math.min(blocks.length - 1, i + 1))}
                className="min-h-12 w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-medium touch-manipulation active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 sm:min-h-0 sm:w-auto sm:py-2.5"
              >
                Далее →
              </button>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="min-h-12 w-full cursor-pointer rounded-xl bg-[hsl(var(--accent))] px-4 py-3.5 text-base font-semibold text-white touch-manipulation active:opacity-90 disabled:cursor-wait disabled:opacity-70 sm:max-w-md sm:py-3 sm:text-sm"
            >
              {pending ? "Отправка…" : "Отправить протокол"}
            </button>
          </div>
        </div>
      </div>
    </form>
    </>
  );
}
