import { blockHasRatingQuestions } from "@/lib/block-scores";
import { computeDiscrepancies } from "@/lib/discrepancies";
import type { Prisma } from "@prisma/client";

/** Пока HR не ввёл имя или интервьюер не отправил протокол — показываем заглушку. */
export function candidateDisplayName(name: string) {
  const t = name.trim();
  return t.length > 0 ? t : "Кандидат (ФИО уточнит интервьюер)";
}

export type VacancyWithRelations = Prisma.VacancyGetPayload<{
  include: {
    blocks: { include: { questions: true } };
    candidates: {
      include: {
        interviewers: {
          include: {
            protocol: { include: { scores: true; questionAnswers: true } };
          };
        };
      };
    };
  };
}>;

export function vacancyKpi(v: VacancyWithRelations) {
  const candidateCount = v.candidates.length;
  let withDisc = 0;
  let sumAvg = 0;
  let avgCount = 0;
  const recCount = { hire: 0, reject: 0, additional: 0, none: 0 };

  const blocks = v.blocks.map((b) => ({
    id: b.id,
    title: b.title,
    hasRatingQuestions: blockHasRatingQuestions(b.questions),
  }));

  for (const c of v.candidates) {
    const protocols = c.interviewers
      .filter((i) => i.protocol && i.protocol.scores.length > 0)
      .map((i) => ({
        interviewerName: i.name,
        scores:
          i.protocol?.scores.map((s) => ({
            planBlockId: s.planBlockId,
            score: s.score,
          })) ?? [],
      }));
    const disc = computeDiscrepancies(blocks, protocols);
    if (disc.length > 0) withDisc++;

    const ratings: number[] = [];
    for (const i of c.interviewers) {
      for (const a of i.protocol?.questionAnswers ?? []) {
        if (a.scoreAnswer != null && a.scoreAnswer >= 1 && a.scoreAnswer <= 5) {
          ratings.push(a.scoreAnswer);
        }
      }
    }
    if (ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      sumAvg += avg;
      avgCount++;
    }

    if (c.summaryJson) {
      try {
        const s = JSON.parse(c.summaryJson) as { recommendation?: string };
        const r = s.recommendation;
        if (r === "hire") recCount.hire++;
        else if (r === "reject") recCount.reject++;
        else if (r === "additional") recCount.additional++;
        else recCount.none++;
      } catch {
        recCount.none++;
      }
    } else {
      recCount.none++;
    }
  }

  return {
    candidateCount,
    withDiscrepancies: withDisc,
    avgScoreAcrossCandidates: avgCount ? Math.round((sumAvg / avgCount) * 10) / 10 : null,
    recommendations: recCount,
  };
}

export function candidateAvgScore(
  c: VacancyWithRelations["candidates"][number],
): number | null {
  const ratings: number[] = [];
  for (const i of c.interviewers) {
    for (const a of i.protocol?.questionAnswers ?? []) {
      if (a.scoreAnswer != null && a.scoreAnswer >= 1 && a.scoreAnswer <= 5) {
        ratings.push(a.scoreAnswer);
      }
    }
  }
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

export function candidateReadiness(c: VacancyWithRelations["candidates"][number], blockCount: number) {
  const total = c.interviewers.length;
  const done = c.interviewers.filter(
    (i) => i.protocol?.submittedAt && (i.protocol.scores.length ?? 0) >= blockCount,
  ).length;
  return { done, total, complete: total > 0 && done === total };
}
