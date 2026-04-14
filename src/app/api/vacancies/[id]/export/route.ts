import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { blockHasRatingQuestions, effectiveBlockOverall } from "@/lib/block-scores";
import { computeDiscrepancies } from "@/lib/discrepancies";
import { recommendationLabelRu } from "@/lib/recommendation-labels";
import { aggregateVacancyBlockOverallScores } from "@/lib/overall-block-score-agg";
import { candidateDisplayName } from "@/lib/stats";

function esc(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = params;
  const v = await prisma.vacancy.findFirst({
    where: { id, userId: session.user.id },
    include: {
      blocks: { orderBy: { sortOrder: "asc" }, include: { questions: true } },
      candidates: {
        include: {
          interviewers: {
            include: {
              protocol: { include: { scores: true, questionAnswers: true } },
            },
          },
        },
      },
    },
  });
  if (!v) return new NextResponse("Not found", { status: 404 });

  const blockScoreRows = await prisma.blockScore.findMany({
    where: { planBlock: { vacancyId: v.id } },
    select: {
      score: true,
      protocol: { select: { interviewer: { select: { candidateId: true } } } },
    },
  });
  const { avgByCandidateId } = aggregateVacancyBlockOverallScores(blockScoreRows);

  const blocks = v.blocks.map((b) => ({
    id: b.id,
    title: b.title,
    hasRatingQuestions: blockHasRatingQuestions(b.questions),
  }));
  const rows: string[][] = [
    [
      "Кандидат",
      "Средний балл",
      "Расхождения (>2)",
      "Рекомендация ИИ",
      "Сильные стороны (кратко)",
      "Риски (кратко)",
    ],
  ];

  for (const c of v.candidates) {
    const avg = avgByCandidateId[c.id];
    const protocols = c.interviewers
      .filter((i) => i.protocol)
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
    let rec = "";
    let strengths = "";
    let risks = "";
    if (c.summaryJson) {
      try {
        const s = JSON.parse(c.summaryJson) as {
          recommendation?: string;
          strengths?: string[];
          risks?: string[];
        };
        rec = recommendationLabelRu(s.recommendation);
        strengths = (s.strengths ?? []).join("; ");
        risks = (s.risks ?? []).join("; ");
      } catch {
        /* ignore */
      }
    }
    rows.push([
      candidateDisplayName(c.name),
      avg !== undefined ? String(avg) : "",
      disc.map((d) => d.blockTitle).join("; "),
      rec,
      strengths,
      risks,
    ]);
  }

  const csv = rows.map((r) => r.map((cell) => esc(cell)).join(",")).join("\n");
  const bom = "\ufeff";
  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vacancy-${v.id.slice(0, 8)}.csv"`,
    },
  });
}
