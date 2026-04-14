import { mergedVacancyProfile } from "@/lib/vacancy-profile";
import { PRIORITY_LABEL, vacancyStatusDisplayLabel, WORK_FORMAT_LABEL } from "@/lib/vacancy-labels";

const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]";
const valClass = "mt-0.5 text-[hsl(var(--foreground))]";

export function VacancyParamsReadonly(props: {
  title: string;
  level: string;
  workFormat: string;
  priority: string;
  status: string;
  hiredCandidateId?: string | null;
  targetCloseDate: Date | null;
  competencies: string;
  expectationsForCandidate: string;
  recruiterInternalNote: string;
}) {
  const {
    title,
    level,
    workFormat,
    priority,
    status,
    hiredCandidateId,
    targetCloseDate,
    competencies,
    expectationsForCandidate,
    recruiterInternalNote,
  } = props;
  const profile = mergedVacancyProfile(competencies, expectationsForCandidate);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-3">
        <p className={labelClass}>Название</p>
        <p className={valClass}>{title}</p>
      </div>
      <div>
        <p className={labelClass}>Уровень</p>
        <p className={valClass}>{level}</p>
      </div>
      <div>
        <p className={labelClass}>Формат работы</p>
        <p className={valClass}>{workFormat ? WORK_FORMAT_LABEL[workFormat] ?? workFormat : "Не указано"}</p>
      </div>
      <div>
        <p className={labelClass}>Приоритет</p>
        <p className={valClass}>{PRIORITY_LABEL[priority] ?? priority}</p>
      </div>
      <div>
        <p className={labelClass}>Статус</p>
        <p className={valClass}>{vacancyStatusDisplayLabel(status, hiredCandidateId)}</p>
      </div>
      <div>
        <p className={labelClass}>Желательная дата закрытия</p>
        <p className={valClass}>
          {targetCloseDate ? new Date(targetCloseDate).toLocaleDateString("ru-RU") : "—"}
        </p>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <p className={labelClass}>Компетенции и пожелания к кандидату</p>
        <p className={`${valClass} mt-1 whitespace-pre-wrap rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm leading-relaxed dark:border-white/10 dark:bg-white/[0.03]`}>
          {profile}
        </p>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <p className={labelClass}>Внутренняя заметка (только HR)</p>
        <p className={`${valClass} mt-1 whitespace-pre-wrap text-sm`}>
          {recruiterInternalNote.trim() ? recruiterInternalNote : "—"}
        </p>
      </div>
    </div>
  );
}
