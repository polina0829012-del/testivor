"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/actions/guards";
import { ensureBuiltInQuestionBank } from "@/lib/ensure-question-bank";

export type QuestionBankCatalogBlock = {
  id: string;
  title: string;
  required: boolean;
  questions: { id: string; text: string; responseType: string }[];
};

/** Только встроенные распространённые блоки и вопросы (направление «Универсальное», без вкладов коллег). */
export async function getQuestionBankCatalog(): Promise<QuestionBankCatalogBlock[]> {
  await requireUserId();
  await ensureBuiltInQuestionBank(prisma);

  const general = await prisma.questionBankDirection.findUnique({
    where: { slug: "general" },
    include: {
      blocks: {
        where: { sourceKey: { not: null } },
        orderBy: { sortOrder: "asc" },
        include: {
          questions: {
            where: { contributedByUserId: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!general) return [];

  return general.blocks.map((b) => ({
    id: b.id,
    title: b.title,
    required: b.required,
    questions: b.questions.map((q) => ({
      id: q.id,
      text: q.text,
      responseType: q.responseType,
    })),
  }));
}
