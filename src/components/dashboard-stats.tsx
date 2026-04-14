import { BarChart3 } from "lucide-react";
import { STATUS_LABEL } from "@/lib/vacancy-labels";

type StatusKey = "draft" | "active" | "on_hold" | "closed";

const STATUS_ORDER: StatusKey[] = ["active", "draft", "on_hold", "closed"];

/** Цвета сегментов (conic-gradient / легенда) — близко к Tailwind emerald/slate/amber/violet 500 */
const PIE_HEX: Record<StatusKey, string> = {
  active: "#10b981",
  draft: "#94a3b8",
  on_hold: "#f59e0b",
  closed: "#8b5cf6",
};

const shell =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

const HIRED_HEX = "#059669";
const REJECT_HEX = "#e11d48";

/** Одинаковый размер колец в обоих блоках; левый блок визуально компактнее за счёт меньшего кольца и текста. */
const donutRingClass =
  "h-[5.5rem] w-[5.5rem] rounded-full shadow-inner ring-1 ring-black/10 dark:ring-white/10 sm:h-[6.25rem] sm:w-[6.25rem]";

const statCardClass =
  "flex min-h-0 min-w-0 flex-col gap-2.5 rounded-xl border border-black/[0.08] bg-white/60 p-3 shadow-sm dark:border-white/10 dark:bg-black/25 sm:flex-row sm:items-stretch sm:gap-3 sm:p-3.5";

export function DashboardStats(props: {
  totalVacancies: number;
  byStatus: Record<string, number>;
  hiredCount: number;
  rejectRecommendationCount: number;
}) {
  const { totalVacancies, byStatus, hiredCount, rejectRecommendationCount } = props;

  return (
    <section className={shell}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] dark:bg-[hsl(var(--accent))]/20">
          <BarChart3 className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold leading-tight tracking-tight">Статистика</h2>
          <p className="mt-1 text-xs leading-snug text-[hsl(var(--muted))]">
            Вакансии по статусам; итоги найма и отказов по сводкам ИИ.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
        <div className={statCardClass}>
          <div className="flex flex-col items-center gap-0.5 sm:w-[6.75rem] sm:shrink-0 sm:items-start sm:pt-0.5">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))] sm:text-left">
              Вакансии · статусы, %
            </p>
            <StatusPieDonut byStatus={byStatus} totalVacancies={totalVacancies} ringClassName={donutRingClass} />
          </div>
          <ul
            className="min-w-0 flex-1 space-y-0 text-xs sm:text-[13px]"
            aria-label="Распределение вакансий по статусам"
          >
            {STATUS_ORDER.map((key) => {
              const n = byStatus[key] ?? 0;
              const pct = totalVacancies ? Math.round((n / totalVacancies) * 100) : 0;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 border-b border-black/[0.04] py-1 last:border-0 last:pb-0 dark:border-white/[0.06]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm ring-1 ring-black/10 dark:ring-white/15"
                      style={{ backgroundColor: PIE_HEX[key] }}
                      aria-hidden
                    />
                    <span className="truncate text-[hsl(var(--foreground))]">{STATUS_LABEL[key] ?? key}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[hsl(var(--muted))]">
                    <span className="font-medium text-[hsl(var(--foreground))]">{pct}%</span>
                    <span className="mx-1 text-[hsl(var(--muted))]">·</span>
                    <span>{n}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={statCardClass}>
          <div className="flex flex-col items-center gap-1 sm:w-[6.75rem] sm:shrink-0 sm:items-start sm:pt-0.5">
            <p className="max-w-[6.75rem] text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-[hsl(var(--muted))] sm:text-left">
              Нанято и отклонено кандидатов
            </p>
            <HireRejectDonut
              hired={hiredCount}
              rejected={rejectRecommendationCount}
              ringClassName={donutRingClass}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center text-xs sm:text-[13px]">
            <ul className="space-y-0" aria-label="Нанято и отклонено кандидатов">
              <li className="flex items-center justify-between gap-2 border-b border-black/[0.04] py-1 dark:border-white/[0.06]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm ring-1 ring-black/10 dark:ring-white/15"
                    style={{ backgroundColor: HIRED_HEX }}
                    aria-hidden
                  />
                  <span className="text-[hsl(var(--foreground))]">Нанято</span>
                </span>
                <span className="shrink-0 tabular-nums text-[hsl(var(--muted))]">
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {outcomeSharePct(hiredCount, hiredCount + rejectRecommendationCount)}%
                  </span>
                  <span className="mx-1">·</span>
                  <span>{hiredCount}</span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-2 py-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm ring-1 ring-black/10 dark:ring-white/15"
                    style={{ backgroundColor: REJECT_HEX }}
                    aria-hidden
                  />
                  <span className="text-[hsl(var(--foreground))]">Отклонено (ИИ)</span>
                </span>
                <span className="shrink-0 tabular-nums text-[hsl(var(--muted))]">
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {outcomeSharePct(rejectRecommendationCount, hiredCount + rejectRecommendationCount)}%
                  </span>
                  <span className="mx-1">·</span>
                  <span>{rejectRecommendationCount}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function outcomeSharePct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function HireRejectDonut({
  hired,
  rejected,
  ringClassName,
}: {
  hired: number;
  rejected: number;
  ringClassName: string;
}) {
  const total = hired + rejected;
  let gradient: string;
  if (total <= 0) {
    gradient = "conic-gradient(from -90deg, #e2e8f0 0% 100%)";
  } else if (rejected <= 0) {
    gradient = `conic-gradient(from -90deg, ${HIRED_HEX} 0% 100%)`;
  } else if (hired <= 0) {
    gradient = `conic-gradient(from -90deg, ${REJECT_HEX} 0% 100%)`;
  } else {
    const hiredPct = (hired / total) * 100;
    gradient = `conic-gradient(from -90deg, ${HIRED_HEX} 0% ${hiredPct}%, ${REJECT_HEX} ${hiredPct}% 100%)`;
  }
  const hasData = total > 0;

  return (
    <div
      className="relative shrink-0"
      role="img"
      aria-label={
        hasData
          ? `Нанято ${hired}, отклонено по сводке ИИ ${rejected}`
          : "Нет данных для диаграммы найма и отказов"
      }
    >
      <div
        className={ringClassName}
        style={{
          background: gradient,
          maskImage: "radial-gradient(farthest-side, transparent 56%, black 57%)",
          WebkitMaskImage: "radial-gradient(farthest-side, transparent 56%, black 57%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {hasData ? (
          <p className="text-lg font-bold tabular-nums leading-none text-[hsl(var(--foreground))] sm:text-xl">{total}</p>
        ) : (
          <span className="max-w-[5.5rem] text-center text-[11px] leading-snug text-[hsl(var(--muted))]">Нет суммы</span>
        )}
      </div>
    </div>
  );
}

function StatusPieDonut({
  byStatus,
  totalVacancies,
  ringClassName,
}: {
  byStatus: Record<string, number>;
  totalVacancies: number;
  ringClassName: string;
}) {
  let acc = 0;
  const stops: string[] = [];
  for (const key of STATUS_ORDER) {
    const n = byStatus[key] ?? 0;
    if (!totalVacancies || n <= 0) continue;
    const frac = n / totalVacancies;
    const startPct = acc * 100;
    acc += frac;
    const endPct = acc * 100;
    stops.push(`${PIE_HEX[key]} ${startPct}% ${endPct}%`);
  }

  const hasData = totalVacancies > 0 && stops.length > 0;
  const gradient = hasData
    ? `conic-gradient(from -90deg, ${stops.join(", ")})`
    : "conic-gradient(from -90deg, #e2e8f0 0% 100%)";

  return (
    <div
      className="relative shrink-0"
      role="img"
      aria-label={
        hasData
          ? `Круговая диаграмма: ${STATUS_ORDER.map((k) => `${STATUS_LABEL[k]} ${totalVacancies ? Math.round(((byStatus[k] ?? 0) / totalVacancies) * 100) : 0}%`).join(", ")}`
          : "Нет вакансий для диаграммы"
      }
    >
      <div
        className={ringClassName}
        style={{
          background: gradient,
          maskImage: "radial-gradient(farthest-side, transparent 56%, black 57%)",
          WebkitMaskImage: "radial-gradient(farthest-side, transparent 56%, black 57%)",
        }}
      />
      {!hasData ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="max-w-[4.5rem] text-center text-[10px] leading-snug text-[hsl(var(--muted))]">Нет вакансий</span>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-lg font-bold tabular-nums leading-none text-[hsl(var(--foreground))] sm:text-xl">{totalVacancies}</p>
        </div>
      )}
    </div>
  );
}
