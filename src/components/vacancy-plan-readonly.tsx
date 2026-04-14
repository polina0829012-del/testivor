import { parseQuestionResponseType, questionResponseTypeLabel } from "@/lib/plan-question-types";

type Block = {
  id: string;
  title: string;
  required: boolean;
  questions: { id: string; text: string; responseType: string }[];
};

const panelShellClass =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

export function VacancyPlanReadonly({ blocks }: { blocks: Block[] }) {
  return (
    <section className={panelShellClass} aria-label="План интервью, только просмотр">
      <h2 className="text-base font-semibold leading-tight tracking-tight">План интервью</h2>
      <p className="mt-1 text-xs text-[hsl(var(--muted))]">
        Вакансия закрыта с наймом — редактирование плана недоступно.
      </p>
      <div className="mt-4 space-y-4 border-t border-black/10 pt-4 dark:border-white/10">
        {blocks.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted))]">Блоков в плане нет.</p>
        ) : (
          blocks.map((block, blockIdx) => (
            <div
              key={block.id}
              className="overflow-hidden rounded-xl border border-black/12 bg-[hsl(var(--surface))] shadow-sm dark:border-white/12"
            >
              <div className="border-b border-black/10 bg-emerald-500/[0.06] px-4 py-2.5 dark:border-white/10 dark:bg-emerald-500/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-emerald-600/15 px-2 text-xs font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                    {blockIdx + 1}
                  </span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{block.title}</span>
                  {block.required ? (
                    <span className="rounded-md bg-emerald-600/20 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
                      Обязательный
                    </span>
                  ) : null}
                </div>
              </div>
              <ul className="divide-y divide-black/10 p-4 dark:divide-white/10">
                {block.questions.map((q, qIdx) => {
                  const rt = parseQuestionResponseType(q.responseType);
                  return (
                    <li key={q.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-[11px] font-semibold text-[hsl(var(--muted))]">Вопрос {qIdx + 1}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--foreground))]">{q.text}</p>
                      <p className="mt-1 text-xs text-[hsl(var(--muted))]">
                        Тип ответа: {questionResponseTypeLabel(rt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
