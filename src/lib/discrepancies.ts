export type Discrepancy = {
  planBlockId: string;
  blockTitle: string;
  minScore: number;
  maxScore: number;
  diff: number;
  byInterviewer: {
    name: string;
    overallScore: number;
    /** Среднее по балльным пунктам плана; null, если в блоке нет балльных вопросов */
    rubricDerivedScore: number | null;
  }[];
};

/**
 * Сравнивает **общие оценки блока** (overallScore) между интервьюерами.
 * В `byInterviewer` дополнительно передаётся rubricDerivedScore для контекста ИИ (расхождение общего мнения и среднего по пунктам).
 */
export function computeDiscrepancies(
  blocks: { id: string; title: string; hasRatingQuestions: boolean }[],
  protocols: {
    interviewerName: string;
    scores: {
      planBlockId: string;
      overallScore: number;
      rubricDerivedScore: number;
    }[];
  }[],
): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const block of blocks) {
    const by: Discrepancy["byInterviewer"] = [];
    for (const p of protocols) {
      const row = p.scores.find((s) => s.planBlockId === block.id);
      if (!row) continue;
      by.push({
        name: p.interviewerName,
        overallScore: row.overallScore,
        rubricDerivedScore: block.hasRatingQuestions ? row.rubricDerivedScore : null,
      });
    }
    if (by.length < 2) continue;
    const vals = by.map((b) => b.overallScore);
    const minScore = Math.min(...vals);
    const maxScore = Math.max(...vals);
    if (maxScore - minScore > 2) {
      out.push({
        planBlockId: block.id,
        blockTitle: block.title,
        minScore,
        maxScore,
        diff: maxScore - minScore,
        byInterviewer: by,
      });
    }
  }
  return out;
}
