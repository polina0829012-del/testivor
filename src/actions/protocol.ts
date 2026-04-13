"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deriveStoredBlockScore } from "@/lib/block-scores";
import { parseQuestionResponseType } from "@/lib/plan-question-types";

export async function getInterviewContext(token: string) {
  const interviewer = await prisma.interviewer.findUnique({
    where: { inviteToken: token },
    include: {
      candidate: {
        include: {
          vacancy: {
            include: {
              blocks: {
                orderBy: { sortOrder: "asc" },
                include: { questions: { orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
      },
      protocol: { include: { scores: true, questionAnswers: true } },
    },
  });
  if (!interviewer) return null;
  return interviewer;
}

export async function submitProtocol(token: string, formData: FormData) {
  const interviewer = await prisma.interviewer.findUnique({
    where: { inviteToken: token },
    include: {
      candidate: {
        include: {
          vacancy: {
            include: {
              blocks: {
                orderBy: { sortOrder: "asc" },
                include: { questions: { orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!interviewer) return { error: "Ссылка недействительна." };

  const candidateNameRaw = String(formData.get("candidateName") ?? "").trim();
  if (candidateNameRaw.length < 2) {
    return { error: "Укажите ФИО кандидата (минимум 2 символа)." };
  }
  if (candidateNameRaw.length > 200) {
    return { error: "Слишком длинное ФИО." };
  }

  const blocks = interviewer.candidate.vacancy.blocks;
  const blockIds = blocks.map((b) => b.id);

  const notes: Record<string, string> = {};
  for (const id of blockIds) {
    const t = formData.get(`notes_${id}`);
    notes[id] = typeof t === "string" ? t.slice(0, 8000) : "";
  }

  const allQuestions = blocks.flatMap((b) => b.questions);
  const questionRows: { planQuestionId: string; textAnswer: string; scoreAnswer: number | null }[] = [];
  for (const q of allQuestions) {
    const rt = parseQuestionResponseType(q.responseType);
    if (rt === "rating") {
      const v = formData.get(`qScore_${q.id}`);
      const n = typeof v === "string" ? Number(v) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return {
          error: `Поставьте балл 1–5 по вопросу: «${q.text.slice(0, 80)}${q.text.length > 80 ? "…" : ""}»`,
        };
      }
      questionRows.push({
        planQuestionId: q.id,
        textAnswer: "",
        scoreAnswer: n,
      });
    } else {
      const t = String(formData.get(`qText_${q.id}`) ?? "").trim();
      if (t.length < 1) {
        return {
          error: `Заполните ответ по вопросу: «${q.text.slice(0, 80)}${q.text.length > 80 ? "…" : ""}»`,
        };
      }
      questionRows.push({
        planQuestionId: q.id,
        textAnswer: t.slice(0, 8000),
        scoreAnswer: null,
      });
    }
  }

  const questionIdToScore = new Map<string, number>();
  for (const row of questionRows) {
    if (row.scoreAnswer != null) questionIdToScore.set(row.planQuestionId, row.scoreAnswer);
  }

  const protocol = await prisma.protocol.upsert({
    where: { interviewerId: interviewer.id },
    create: { interviewerId: interviewer.id },
    update: {},
  });

  await prisma.$transaction([
    prisma.questionAnswer.deleteMany({ where: { protocolId: protocol.id } }),
    prisma.blockScore.deleteMany({ where: { protocolId: protocol.id } }),
    ...blocks.map((block) => {
      const score = deriveStoredBlockScore(block.questions, questionIdToScore);
      return prisma.blockScore.create({
        data: {
          protocolId: protocol.id,
          planBlockId: block.id,
          score,
          notes: notes[block.id] ?? "",
        },
      });
    }),
    ...questionRows.map((row) =>
      prisma.questionAnswer.create({
        data: {
          protocolId: protocol.id,
          planQuestionId: row.planQuestionId,
          textAnswer: row.textAnswer,
          scoreAnswer: row.scoreAnswer,
        },
      }),
    ),
    prisma.protocol.update({
      where: { id: protocol.id },
      data: { submittedAt: new Date() },
    }),
    prisma.candidate.update({
      where: { id: interviewer.candidateId },
      data: { name: candidateNameRaw },
    }),
  ]);

  const vacancyId = interviewer.candidate.vacancyId;
  const candidateId = interviewer.candidateId;
  revalidatePath(`/vacancies/${vacancyId}`);
  revalidatePath(`/vacancies/${vacancyId}/candidates/${candidateId}`);
  revalidatePath(`/interview/${token}`);
  return { ok: true as const };
}
