import { BarChart3 } from "lucide-react";
import { STATUS_LABEL } from "@/lib/vacancy-labels";

type StatusKey = "draft" | "active" | "on_hold" | "closed";

const STATUS_ORDER: StatusKey[] = ["active", "draft", "on_hold", "closed"];

const BAR_CLASS: Record<StatusKey, string> = {
  active: "bg-emerald-500",
  draft: "bg-slate-400 dark:bg-slate-500",
  on_hold: "bg-amber-500",
  closed: "bg-violet-500",
};

const shell =
  "rounded-2xl border border-black/[0.07] bg-[hsl(var(--surface))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-none dark:ring-white/[0.04] sm:p-6";

export function DashboardStats(props: {
  totalVacancies: number;
  totalCandidates: number;
  closedCount: number;
  byStatus: Record<string, number>;
}) {
  const { totalVacancies, totalCandidates, closedCount, byStatus } = props;

  return (
    <section className={shell}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] dark:bg-[hsl(var(--accent))]/20">
          <BarChart3 className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold leading-tight tracking-tight">Статистика</h2>
          <p className="mt-1 text-xs leading-snug text-[hsl(var(--muted))]">
            По всем вакансиям в системе и кандидатам.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Всего вакансий" value={totalVacancies} />
        <StatCard label="Закрытых" value={closedCount} sub="«Закрыта»" />
        <StatCard label="Кандидатов" value={totalCandidates} />
      </div>

      <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/10">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">Доли статусов, %</h3>
        <div className="mt-2 flex max-w-full flex-nowrap items-center gap-x-2 overflow-x-auto pb-0.5 text-[10px] leading-tight [-webkit-overflow-scrolling:touch]">
          {STATUS_ORDER.map((key, i) => {
            const n = byStatus[key] ?? 0;
            const pct = totalVacancies ? Math.round((n / totalVacancies) * 100) : 0;
            return (
              <span key={key} className="inline-flex shrink-0 items-center gap-1">
                {i > 0 ? <span className="text-[hsl(var(--muted))]">·</span> : null}
                <span className={`inline-block h-2 w-2 shrink-0 rounded-sm ${BAR_CLASS[key]}`} />
                <span className="text-[hsl(var(--foreground))]">{STATUS_LABEL[key] ?? key}</span>
                <span className="tabular-nums text-[hsl(var(--muted))]">
                  {n} ({pct}%)
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white/60 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-black/25">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted))]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-none tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-[10px] text-[hsl(var(--muted))]">{sub}</p> : null}
    </div>
  );
}
