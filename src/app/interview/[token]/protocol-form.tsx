"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitProtocol } from "@/actions/protocol";
import type { QuestionResponseType } from "@/lib/plan-question-types";
import { questionResponseTypeLabel } from "@/lib/plan-question-types";

type Block = {
  id: string;
  title: string;
  required: boolean;
  questions: { id: string; text: string; responseType: QuestionResponseType }[];
};

function validateBeforeSubmit(fd: FormData, blocks: Block[]): { error: string; blockIndex: number } | null {
  const name = String(fd.get("candidateName") ?? "").trim();
  if (name.length < 2) {
    return { error: "Укажите ФИО кандидата (минимум 2 символа).", blockIndex: 0 };
  }
  if (name.length > 200) {
    return { error: "Слишком длинное ФИО.", blockIndex: 0 };
  }

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    for (const q of block.questions) {
      if (q.responseType === "rating") {
        const v = fd.get(`qScore_${q.id}`);
        const num = typeof v === "string" ? Number(v) : NaN;
        if (!Number.isInteger(num) || num < 1 || num > 5) {
          return {
            error: `Поставьте балл 1–5 по каждому пункту в блоке «${block.title}».`,
            blockIndex: bi,
          };
        }
      } else {
        const t = String(fd.get(`qText_${q.id}`) ?? "").trim();
        if (t.length < 1) {
          return {
            error: `Заполните текстовые ответы по всем пунктам в блоке «${block.title}».`,
            blockIndex: bi,
          };
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
}: {
  token: string;
  blocks: Block[];
  existingByBlockId: Record<string, { notes: string } | undefined>;
  existingByQuestionId: Record<string, { textAnswer: string; scoreAnswer: number | null } | undefined>;
  initialCandidateName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const skipScrollOnMount = useRef(true);

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
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 text-center text-neutral-900"
        role="status"
        aria-live="polite"
      >
        <p className="text-xl font-semibold sm:text-2xl">Протокол успешно отправлен HR</p>
        <p className="mt-3 max-w-md text-sm text-neutral-600">
          Спасибо. Можно закрыть эту вкладку — данные сохранены.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-4 flex flex-1 flex-col gap-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const validation = validateBeforeSubmit(fd, blocks);
        if (validation) {
          setError(validation.error);
          setActiveBlockIndex(validation.blockIndex);
          return;
        }
        startTransition(async () => {
          const result = await submitProtocol(token, fd);
          if (result && "error" in result && result.error) {
            setError(result.error);
            return;
          }
          setSubmitted(true);
        });
      }}
    >
      <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10 lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1">
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
            placeholder="Как указать в системе для HR"
            className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 dark:border-white/10 lg:mt-1"
          />
        </div>
        <p className="mt-2 text-xs text-[hsl(var(--muted))] lg:mt-7 lg:max-w-sm lg:shrink-0">
          Имя сохранится вместе с протоколом. Если HR уже ввёл имя — проверьте и при необходимости исправьте.
        </p>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-1 lg:sticky lg:top-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">Блоки плана</p>
          <nav className="flex flex-row gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Блоки интервью">
            {blocks.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-current={i === activeBlockIndex ? "true" : undefined}
                onClick={() => setActiveBlockIndex(i)}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors lg:w-full ${
                  i === activeBlockIndex
                    ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/12 font-medium text-[hsl(var(--accent))] shadow-sm"
                    : "border-black/10 bg-[hsl(var(--surface))] text-neutral-800 hover:border-black/20 dark:border-white/10 dark:text-neutral-100 dark:hover:border-white/20"
                }`}
              >
                <span className="text-xs text-[hsl(var(--muted))]">Блок {i + 1}</span>
                <span className="mt-0.5 block leading-snug">{b.title}</span>
                {b.required ? (
                  <span className="mt-1 inline-block text-[10px] font-medium uppercase text-amber-700 dark:text-amber-300">
                    Обязательный
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <p className="hidden text-xs text-[hsl(var(--muted))] lg:block">
            Активен блок {activeBlockIndex + 1} из {blocks.length}
          </p>
        </aside>

        <div ref={mainPanelRef} className="min-w-0 space-y-3">
          {blocks.map((block, blockIndex) => {
            const existing = existingByBlockId[block.id];
            const isActive = blockIndex === activeBlockIndex;

            return (
              <div key={block.id} className={isActive ? "" : "hidden"}>
                <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] dark:border-white/10">
                  <div className="border-b border-black/10 px-4 py-3 dark:border-white/10 sm:px-6 sm:py-4">
                    <h2 className="text-lg font-semibold leading-snug sm:text-xl">{block.title}</h2>
                    {block.required ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Обязательный блок</p>
                    ) : null}
                    <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                      Пункты с баллами на широком экране стоят в две колонки, текстовые — на всю ширину. Отдельной прокрутки внутри блока нет.
                    </p>
                  </div>

                  <div className="px-4 py-3 sm:px-6 sm:py-4">
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
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] font-medium text-[hsl(var(--muted))]">
                                    {qi + 1}. {questionResponseTypeLabel("rating")}
                                  </span>
                                  <p className="mt-0.5 text-sm font-medium leading-snug">{q.text}</p>
                                </div>
                                <div className="shrink-0 sm:w-[7.5rem]">
                                  <label className="sr-only" htmlFor={`qScore_${q.id}`}>
                                    Балл 1–5 по вопросу «{q.text}»
                                  </label>
                                  <select
                                    id={`qScore_${q.id}`}
                                    name={`qScore_${q.id}`}
                                    defaultValue={sc}
                                    className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm dark:border-white/10"
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
                            <p className="mt-0.5 text-sm font-medium leading-snug">{q.text}</p>
                            <label className="mt-1.5 block text-[11px] font-medium text-[hsl(var(--muted))]" htmlFor={`qText_${q.id}`}>
                              Ответ / заметки
                            </label>
                            <textarea
                              id={`qText_${q.id}`}
                              name={`qText_${q.id}`}
                              rows={2}
                              defaultValue={ex?.textAnswer ?? ""}
                              className="mt-1 w-full resize-y rounded-lg border border-black/10 px-2 py-1.5 text-sm leading-snug dark:border-white/10"
                            />
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  <div className="border-t border-black/10 px-4 py-3 dark:border-white/10 sm:px-6 sm:py-4">
                    <label className="text-sm font-medium" htmlFor={`notes_${block.id}`}>
                      Заметки по блоку (необязательно)
                    </label>
                    <textarea
                      id={`notes_${block.id}`}
                      name={`notes_${block.id}`}
                      rows={2}
                      defaultValue={existing?.notes ?? ""}
                      placeholder="Общие впечатления по разделу, контекст для HR"
                      className="mt-1.5 w-full resize-y rounded-lg border border-black/10 px-2 py-1.5 text-sm dark:border-white/10"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => setActiveBlockIndex((i) => Math.max(0, i - 1))}
                className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20"
              >
                ← Предыдущий блок
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={() => setActiveBlockIndex((i) => Math.min(blocks.length - 1, i + 1))}
                className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20"
              >
                Следующий блок →
              </button>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full max-w-md cursor-pointer rounded-xl bg-[hsl(var(--accent))] py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? "Отправка…" : "Отправить протокол"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
