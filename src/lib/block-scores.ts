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
 * Значение для BlockScore.score: среднее по балльным вопросам блока, округление 1–5.
 * Если в блоке нет балльных вопросов — нейтральное 3 (строка в БД для целостности протокола).
 */
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
