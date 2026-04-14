import Link from "next/link";
import { closeVacancyWithOptionalHire, reopenVacancyToActive } from "@/actions/vacancies";
import { FormSubmitButton } from "@/components/form-submit-button";
import { candidateDisplayName } from "@/lib/stats";
import { vacancyStatusDisplayLabel } from "@/lib/vacancy-labels";

const selectClass =
  "min-h-10 w-full min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[hsl(var(--accent))]/45 focus:ring-2 focus:ring-[hsl(var(--accent))]/18 dark:border-white/12 dark:bg-black/35 dark:focus:border-[hsl(var(--accent))]/40";

const btnClass =
  "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[hsl(var(--accent))] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-[0.96]";

export function VacancyCloseHirePanel(props: {
  vacancyId: string;
  status: string;
  candidates: { id: string; name: string }[];
  hiredCandidate: { id: string; name: string } | null;
  showInvalidCandidateError?: boolean;
}) {
  const {
    vacancyId,
    status,
    candidates,
    hiredCandidate,
    showInvalidCandidateError,
  } = props;
  const isClosed = status === "closed";

  return (
    <section
      className="rounded-lg border border-black/12 bg-gradient-to-br from-[hsl(var(--accent))]/[0.06] to-transparent px-3 py-2.5 dark:border-white/12 dark:from-[hsl(var(--accent))]/10 sm:px-3.5"
      aria-label="Закрытие вакансии и найм"
    >
      <h2 className="text-xs font-semibold tracking-tight text-[hsl(var(--foreground))]">
        Закрытие и трудоустройство
      </h2>
      {!isClosed ? (
        <p className="mt-0.5 text-[11px] leading-snug text-[hsl(var(--muted))]">
          Кандидат по желанию; «Деактивирована» также в параметрах вакансии.
        </p>
      ) : null}
      {showInvalidCandidateError ? (
        <p className="mt-1.5 rounded-md border border-red-200/80 bg-red-50/90 px-2 py-1 text-[11px] text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-100">
          Не удалось закрыть: кандидат не с этой вакансии.
        </p>
      ) : null}
      {isClosed ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="rounded-md bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium dark:bg-white/10">
            {vacancyStatusDisplayLabel(status, hiredCandidate?.id ?? null)}
          </span>
          <span className="text-[hsl(var(--muted))]">Принят:</span>
          <span className="font-medium text-[hsl(var(--foreground))]">
            {hiredCandidate
              ? candidateDisplayName(hiredCandidate.name)
              : "не зафиксирован"}
          </span>
          {hiredCandidate ? (
            <Link
              href={`/vacancies/${vacancyId}/candidates/${hiredCandidate.id}`}
              className="text-xs font-medium text-[hsl(var(--accent))] underline-offset-2 hover:underline"
            >
              карточка
            </Link>
          ) : null}
        </div>
      ) : null}
      {isClosed && hiredCandidate ? (
        <form action={reopenVacancyToActive.bind(null, vacancyId)} className="mt-2">
          <FormSubmitButton
            pendingLabel="Сохранение…"
            className="inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-emerald-600/45 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60 sm:w-auto"
          >
            Вернуть вакансию в работу
          </FormSubmitButton>
        </form>
      ) : null}
      {!isClosed ? (
        <form
          action={closeVacancyWithOptionalHire.bind(null, vacancyId)}
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <label className="sr-only" htmlFor={`hire-candidate-${vacancyId}`}>
            Кандидат на трудоустройство
          </label>
          <select
            id={`hire-candidate-${vacancyId}`}
            name="hiredCandidateId"
            defaultValue=""
            className={selectClass}
          >
            <option value="">Без выбора (без фиксации найма)</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {candidateDisplayName(c.name)}
              </option>
            ))}
          </select>
          <FormSubmitButton pendingLabel="Закрытие…" className={btnClass}>
            Закрыть вакансию
          </FormSubmitButton>
        </form>
      ) : null}
    </section>
  );
}
