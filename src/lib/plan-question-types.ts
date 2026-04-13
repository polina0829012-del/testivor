export const QUESTION_RESPONSE_TYPES = ["text", "rating"] as const;
export type QuestionResponseType = (typeof QUESTION_RESPONSE_TYPES)[number];

export function parseQuestionResponseType(v: string | null | undefined): QuestionResponseType {
  return v === "rating" ? "rating" : "text";
}

export function questionResponseTypeLabel(t: QuestionResponseType): string {
  return t === "rating" ? "Балл 1–5 по пункту" : "Развёрнутый ответ (текст)";
}
