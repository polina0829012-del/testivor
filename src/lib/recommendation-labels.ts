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
