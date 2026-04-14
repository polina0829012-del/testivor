"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Briefcase, ClipboardList, SlidersHorizontal, StickyNote } from "lucide-react";
import { createVacancy } from "@/actions/vacancies";

const fieldBase =
  "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]/45 focus:ring-2 focus:ring-[hsl(var(--accent))]/18 dark:border-white/12 dark:bg-black/35 dark:focus:border-[hsl(var(--accent))]/40";

const cardBase =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

function SectionTitle({ icon: Icon, title, hint }: { icon: typeof Briefcase; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] dark:bg-[hsl(var(--accent))]/20">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-semibold leading-tight tracking-tight">{title}</h2>
        {hint ? <p className="mt-1 text-xs leading-snug text-[hsl(var(--muted))]">{hint}</p> : null}
      </div>
    </div>
  );
}

export function CreateVacancyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-6 xl:grid-cols-12 xl:gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await createVacancy(fd);
          if (r && "error" in r && r.error) {
            setError(r.error);
            return;
          }
          if (r && "ok" in r && r.ok) router.push(`/vacancies/${r.id}`);
        });
      }}
    >
      <div className="space-y-6 xl:col-span-8">
        <section className={cardBase}>
          <SectionTitle
            icon={Briefcase}
            title="Основное"
            hint="Название и уровень — как позиция отображается в списках и карточке."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
                Название вакансии <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                placeholder="Например, Senior Product Analyst"
                className={fieldBase}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
                Уровень <span className="text-red-500">*</span>
              </label>
              <input name="level" required placeholder="Middle, Senior, Lead…" className={fieldBase} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
                Формат работы
              </label>
              <select name="workFormat" className={fieldBase} defaultValue="">
                <option value="">Не указано</option>
                <option value="office">Офис</option>
                <option value="hybrid">Гибрид</option>
                <option value="remote">Удалённо</option>
              </select>
            </div>
          </div>
        </section>

        <section
          className={`${cardBase} border-[hsl(var(--accent))]/20 bg-gradient-to-br from-[hsl(var(--accent))]/[0.06] to-transparent dark:border-[hsl(var(--accent))]/25 dark:from-[hsl(var(--accent))]/10`}
        >
          <SectionTitle
            icon={ClipboardList}
            title="Компетенции и пожелания к кандидату"
            hint="В одном месте: стек и задачи, софт-скиллы, культура, контекст команды — для скрининга, карточки вакансии и генерации плана интервью (ИИ получает полный контекст)."
          />
          <label className="sr-only" htmlFor="new-vacancy-competencies">
            Компетенции и пожелания к кандидату
          </label>
          <textarea
            id="new-vacancy-competencies"
            name="competencies"
            required
            rows={3}
            placeholder="Навыки и опыт (SQL, продуктовая аналитика…), ожидания по уровню, стиль работы, пожелания заказчика, онбординг, особенности команды…"
            className={fieldBase}
          />
        </section>

        <section className={`${cardBase} border-dashed border-black/15 dark:border-white/15`}>
          <SectionTitle
            icon={StickyNote}
            title="Внутренняя заметка"
            hint="Только для HR: бюджет, внутренняя политика, комментарии — не показывается интервьюерам."
          />
          <label className="sr-only" htmlFor="new-vacancy-internal">
            Внутренняя заметка
          </label>
          <textarea
            id="new-vacancy-internal"
            name="recruiterInternalNote"
            rows={3}
            placeholder="Необязательно"
            className={fieldBase}
          />
        </section>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <section
          className={`${cardBase} xl:sticky xl:top-24 xl:max-h-[min(100vh-7rem,40rem)] xl:overflow-y-auto xl:overscroll-contain`}
        >
          <SectionTitle
            icon={SlidersHorizontal}
            title="Параметры"
            hint="Приоритет, статус и срок — для дашборда и приоритизации."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">Приоритет</label>
              <select name="priority" className={fieldBase} defaultValue="normal">
                <option value="low">Низкий</option>
                <option value="normal">Обычный</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочно</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">Статус</label>
              <select name="status" className={fieldBase} defaultValue="active">
                <option value="draft">Черновик</option>
                <option value="active">В работе</option>
                <option value="on_hold">Пауза</option>
                <option value="closed">Деактивирована</option>
              </select>
            </div>
            <div className="sm:col-span-2 xl:col-span-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
                Желательная дата закрытия
              </label>
              <input name="targetCloseDate" type="date" className={fieldBase} />
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-4 border-t border-black/[0.06] pt-6 dark:border-white/10 xl:col-span-12">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[hsl(var(--accent))] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[hsl(var(--accent))]/25 transition hover:opacity-[0.96] disabled:opacity-50"
          >
            {pending ? "Создание…" : "Создать вакансию"}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/12 bg-black/[0.02] px-6 py-2.5 text-sm font-medium transition hover:bg-black/[0.05] dark:border-white/12 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
          >
            Отмена
          </Link>
        </div>
      </div>
    </form>
  );
}
