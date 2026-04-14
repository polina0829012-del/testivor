/**
 * Агрегация оценок блоков по `BlockScore.score` в select — поле есть в любом сгенерированном Prisma Client.
 * После `npx prisma generate` и миграции `overallScore` в данных совпадает с общей оценкой; для среднего по вакансии достаточно `score`.
 */

export type BlockScoreRowWithCandidate = {
  score: number;
  protocol: { interviewer: { candidateId: string } };
};

function mean1to5(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** Среднее по списку строк BlockScore (только для одного кандидата и т.п.). */
export function meanOverallFromBlockScoreRows(rows: readonly { score: number }[]): number | null {
  const vals = rows
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  return mean1to5(vals);
}

/** По всем оценкам блоков вакансии + среднее по каждому кандидату. */
export function aggregateVacancyBlockOverallScores(rows: BlockScoreRowWithCandidate[]) {
  const vacancyVals: number[] = [];
  const byCandidate = new Map<string, number[]>();

  for (const row of rows) {
    const n = Number(row.score);
    if (!Number.isFinite(n) || n < 1 || n > 5) continue;
    vacancyVals.push(n);
    const cid = row.protocol.interviewer.candidateId;
    let arr = byCandidate.get(cid);
    if (!arr) {
      arr = [];
      byCandidate.set(cid, arr);
    }
    arr.push(n);
  }

  const avgByCandidateId: Record<string, number> = {};
  byCandidate.forEach((vals, cid) => {
    const m = mean1to5(vals);
    if (m != null) avgByCandidateId[cid] = m;
  });

  return {
    vacancyAvg: mean1to5(vacancyVals),
    scoreCount: vacancyVals.length,
    avgByCandidateId,
  };
}
