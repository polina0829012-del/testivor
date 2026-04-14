"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
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

  const notes: Record<string, string> = {};
  const overallByBlock: Record<string, number> = {};
  const questionRows: { planQuestionId: string; textAnswer: string; scoreAnswer: number | null }[] = [];

  for (const block of blocks) {
    const id = block.id;
    const t = formData.get(`notes_${id}`);
    notes[id] = typeof t === "string" ? t.slice(0, 8000) : "";
    const ov = formData.get(`overall_${id}`);
    const on = typeof ov === "string" ? Number(ov) : NaN;

    if (block.required) {
      if (!Number.isInteger(on) || on < 1 || on > 5) {
        return { error: "REQUIRED_BLOCKS_INCOMPLETE" };
      }
      overallByBlock[id] = on;
      for (const q of block.questions) {
        const rt = parseQuestionResponseType(q.responseType);
        if (rt === "rating") {
          const v = formData.get(`qScore_${q.id}`);
          const n = typeof v === "string" ? Number(v) : NaN;
          if (!Number.isInteger(n) || n < 1 || n > 5) {
            return { error: "REQUIRED_BLOCKS_INCOMPLETE" };
          }
          questionRows.push({ planQuestionId: q.id, textAnswer: "", scoreAnswer: n });
        } else {
          const text = String(formData.get(`qText_${q.id}`) ?? "").trim();
          if (text.length < 1) {
            return { error: "REQUIRED_BLOCKS_INCOMPLETE" };
          }
          questionRows.push({
            planQuestionId: q.id,
            textAnswer: text.slice(0, 8000),
            scoreAnswer: null,
          });
        }
      }
    } else {
      overallByBlock[id] =
        Number.isInteger(on) && on >= 1 && on <= 5 ? on : 3;
      for (const q of block.questions) {
        const rt = parseQuestionResponseType(q.responseType);
        if (rt === "rating") {
          const v = formData.get(`qScore_${q.id}`);
          const n = typeof v === "string" ? Number(v) : NaN;
          const score =
            Number.isInteger(n) && n >= 1 && n <= 5 ? n : 3;
          questionRows.push({ planQuestionId: q.id, textAnswer: "", scoreAnswer: score });
        } else {
          const text = String(formData.get(`qText_${q.id}`) ?? "").trim();
          questionRows.push({
            planQuestionId: q.id,
            textAnswer: text.slice(0, 8000),
            scoreAnswer: null,
          });
        }
      }
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
      const rubricDerived = deriveStoredBlockScore(block.questions, questionIdToScore);
      const overall = overallByBlock[block.id] ?? 3;
      const notesStr = notes[block.id] ?? "";
      /** Raw INSERT: старый сгенерированный Prisma Client без поля `overallScore` в типах ломает `blockScore.create`. */
      return prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "BlockScore" ("id", "protocolId", "planBlockId", "score", "notes", "overallScore")
          VALUES (${randomUUID()}, ${protocol.id}, ${block.id}, ${rubricDerived}, ${notesStr}, ${overall})
        `,
      );
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
