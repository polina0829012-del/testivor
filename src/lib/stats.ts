import { blockHasRatingQuestions, effectiveBlockOverall } from "@/lib/block-scores";
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
  const blockCount = v.blocks.length;
  let withDisc = 0;
  const recCount = { hire: 0, reject: 0, additional: 0, none: 0 };
  let fullyCompleteCandidates = 0;
  let sumReadinessSlotPct = 0;
  let readinessSlotDenom = 0;

  const blocks = v.blocks.map((b) => ({
    id: b.id,
    title: b.title,
    hasRatingQuestions: blockHasRatingQuestions(b.questions),
  }));

  for (const c of v.candidates) {
    const readiness = candidateReadiness(c, blockCount);
    if (readiness.complete) fullyCompleteCandidates++;
    if (readiness.total > 0) {
      sumReadinessSlotPct += (readiness.done / readiness.total) * 100;
      readinessSlotDenom++;
    }

    const protocols = c.interviewers
      .filter((i) => (i.protocol?.scores?.length ?? 0) > 0)
      .map((i) => ({
        interviewerName: i.name,
        scores:
          (i.protocol?.scores ?? []).map((s) => ({
            planBlockId: s.planBlockId,
            overallScore: effectiveBlockOverall(s),
            rubricDerivedScore: s.score,
          })),
      }));
    const disc = computeDiscrepancies(blocks, protocols);
    if (disc.length > 0) withDisc++;

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
    recommendations: recCount,
    readiness: {
      fullyCompleteCandidates,
      avgSlotPercentAcrossCandidates: readinessSlotDenom
        ? Math.round(sumReadinessSlotPct / readinessSlotDenom)
        : null,
    },
  };
}

/**
 * Данные для среднего балла по оценкам блоков во всех сданных протоколах (`effectiveBlockOverall`).
 */
export type CandidateInterviewersForAvg = {
  interviewers: {
    protocol?: { scores?: { overallScore?: number | null; score: number }[] | null } | null;
  }[];
};

/** Среднее по всем оценкам блоков во всех протоколах кандидата (1–5). */
export function candidateAvgScore(c: CandidateInterviewersForAvg): number | null {
  const vals: number[] = [];
  for (const i of c.interviewers) {
    for (const s of i.protocol?.scores ?? []) {
      const n = effectiveBlockOverall(s);
      if (n >= 1 && n <= 5) vals.push(n);
    }
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function candidateReadiness(c: VacancyWithRelations["candidates"][number], blockCount: number) {
  const total = c.interviewers.length;
  const done = c.interviewers.filter(
    (i) => i.protocol?.submittedAt && (i.protocol.scores?.length ?? 0) >= blockCount,
  ).length;
  return { done, total, complete: total > 0 && done === total };
}
