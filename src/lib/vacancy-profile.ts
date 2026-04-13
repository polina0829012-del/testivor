/**
 * Единое текстовое описание роли для UI и ИИ.
 * Старые записи могли хранить часть текста в `expectationsForCandidate` — склеиваем для отображения и промптов.
 */
export function mergedVacancyProfile(competencies: string, expectationsForCandidate: string): string {
  const a = (competencies ?? "").trim();
  const b = (expectationsForCandidate ?? "").trim();
  if (!b) return a;
  if (!a) return b;
  return `${a}\n\n${b}`;
}
