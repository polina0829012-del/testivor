export type Discrepancy = {
  planBlockId: string;
  blockTitle: string;
  minScore: number;
  maxScore: number;
  diff: number;
  byInterviewer: { name: string; score: number }[];
};

export function computeDiscrepancies(
  blocks: { id: string; title: string; hasRatingQuestions: boolean }[],
  protocols: {
    interviewerName: string;
    scores: { planBlockId: string; score: number }[];
  }[],
): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const block of blocks) {
    if (!block.hasRatingQuestions) continue;
    const by: { name: string; score: number }[] = [];
    for (const p of protocols) {
      const row = p.scores.find((s) => s.planBlockId === block.id);
      if (row) by.push({ name: p.interviewerName, score: row.score });
    }
    if (by.length < 2) continue;
    const vals = by.map((b) => b.score);
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
