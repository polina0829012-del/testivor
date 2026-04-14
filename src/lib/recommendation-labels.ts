/** Значения recommendation из JSON ИИ (summarizeCandidate). */
export type RecommendationCode = "hire" | "reject" | "additional";

const LONG: Record<RecommendationCode, string> = {
  hire: "Рекомендуем приглашение на следующий этап / к найму",
  reject: "Не рекомендуем: кандидат не подходит по текущим данным",
  additional: "Нужны дополнительные интервью или уточняющий этап",
};

const SHORT: Record<RecommendationCode, string> = {
  hire: "Нанять",
  reject: "Отказ",
  additional: "Доп. интервью",
};

function normalizeCode(raw: unknown): RecommendationCode | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase();
  if (k === "hire" || k === "reject" || k === "additional") return k;
  return null;
}

/** Человекочитаемая формулировка для карточки кандидата и выгрузок. */
export function recommendationLabelRu(raw: unknown): string {
  const code = normalizeCode(raw);
  if (code) return LONG[code];
  if (raw == null || raw === "") return "—";
  return String(raw);
}

/** Короткая подпись для сводных KPI по вакансии. */
export function recommendationShortLabelRu(raw: unknown): string {
  const code = normalizeCode(raw);
  if (code) return SHORT[code];
  return "—";
}

/** Строка счётчиков: «Нанять: 2 · Отказ: 1 · Доп. интервью: 0». */
export function formatRecommendationKpiLine(counts: {
  hire: number;
  reject: number;
  additional: number;
}): string {
  return `Нанять: ${counts.hire} · Отказ: ${counts.reject} · Доп. интервью: ${counts.additional}`;
}

/** Короткая и длинная подписи + код для UI (дашборд кандидата). */
export function recommendationStructured(raw: unknown): {
  code: RecommendationCode | null;
  shortLabel: string;
  longLabel: string;
} {
  const code = normalizeCode(raw);
  if (code) {
    return { code, shortLabel: SHORT[code], longLabel: LONG[code] };
  }
  if (raw == null || raw === "") {
    return {
      code: null,
      shortLabel: "Нет сводки",
      longLabel: "Нажмите «AI: сводка», чтобы получить рекомендацию модели.",
    };
  }
  return {
    code: null,
    shortLabel: "—",
    longLabel: String(raw),
  };
}

/** Стили чипа рекомендации на светлой/тёмной теме. */
export function recommendationChipClassName(code: RecommendationCode | null): string {
  if (code === "hire") {
    return "border-emerald-500/40 bg-emerald-500/12 text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-100";
  }
  if (code === "reject") {
    return "border-red-500/35 bg-red-500/10 text-red-950 dark:border-red-400/35 dark:bg-red-950/40 dark:text-red-100";
  }
  if (code === "additional") {
    return "border-amber-500/40 bg-amber-500/12 text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/35 dark:text-amber-100";
  }
  return "border-black/10 bg-black/[0.04] text-[hsl(var(--foreground))] dark:border-white/15 dark:bg-white/[0.06]";
}
