/** Сколько кандидатов в сводке ИИ с recommendation === "reject". */
export function countCandidatesWithRejectRecommendation(
  rows: { summaryJson: string | null }[],
): number {
  let n = 0;
  for (const c of rows) {
    if (!c.summaryJson) continue;
    try {
      const s = JSON.parse(c.summaryJson) as { recommendation?: string };
      if (s.recommendation === "reject") n++;
    } catch {
      /* ignore */
    }
  }
  return n;
}
