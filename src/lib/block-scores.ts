import { parseQuestionResponseType } from "@/lib/plan-question-types";

/** Среднее по балльным вопросам блока (для отображения и расхождений). */
export function averageRatingForBlock(
  questions: { id: string; responseType: string }[],
  answers: { planQuestionId: string; scoreAnswer: number | null }[],
): number | null {
  const vals: number[] = [];
  for (const q of questions) {
    if (parseQuestionResponseType(q.responseType) !== "rating") continue;
    const a = answers.find((x) => x.planQuestionId === q.id);
    if (a?.scoreAnswer != null && a.scoreAnswer >= 1 && a.scoreAnswer <= 5) {
      vals.push(a.scoreAnswer);
    }
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) / 10;
}

export function blockHasRatingQuestions(questions: { responseType: string }[]): boolean {
  return questions.some((q) => parseQuestionResponseType(q.responseType) === "rating");
}

/**
 * Значение для `BlockScore.score` (производное): среднее по балльным пунктам плана в блоке, округление 1–5.
 * Если в блоке нет балльных вопросов — 3. Итоговая оценка интервьюера хранится отдельно в `overallScore`.
 */
/**
 * «Общая» оценка блока для UI и расхождений (1–5).
 * В актуальной схеме хранится в `overallScore`; если сгенерированный Prisma Client ещё без этого поля
 * или колонка не подтянута — берём `score` (рубрика / данные до миграции).
 */
export function effectiveBlockOverall(s: { overallScore?: number | null; score?: number | null }): number {
  const o = s.overallScore != null ? Number(s.overallScore) : NaN;
  if (Number.isFinite(o) && o >= 1 && o <= 5) return Math.round(o);
  const r = s.score != null ? Number(s.score) : NaN;
  if (Number.isFinite(r) && r >= 1 && r <= 5) return Math.round(r);
  return 3;
}

export function deriveStoredBlockScore(
  questions: { id: string; responseType: string }[],
  questionIdToScore: Map<string, number>,
): number {
  const vals: number[] = [];
  for (const q of questions) {
    if (parseQuestionResponseType(q.responseType) !== "rating") continue;
    const v = questionIdToScore.get(q.id);
    if (v != null && Number.isInteger(v) && v >= 1 && v <= 5) vals.push(v);
  }
  if (vals.length === 0) return 3;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.min(5, Math.max(1, Math.round(avg)));
}
