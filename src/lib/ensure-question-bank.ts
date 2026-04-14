import type { PrismaClient } from "@prisma/client";
import { QUESTION_BANK_BLOCKS } from "./question-bank";
import { QUESTION_BANK_DIRECTION_SEEDS } from "./question-bank-directions";

/**
 * Идемпотентно: направления + встроенные блоки из `QUESTION_BANK_BLOCKS` в направлении «Универсальное».
 * Вызывать перед чтением каталога банка.
 */
export async function ensureBuiltInQuestionBank(db: PrismaClient) {
  for (const d of QUESTION_BANK_DIRECTION_SEEDS) {
    await db.questionBankDirection.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, label: d.label, sortOrder: d.sortOrder },
      update: { label: d.label, sortOrder: d.sortOrder },
    });
  }

  const general = await db.questionBankDirection.findUnique({
    where: { slug: "general" },
  });
  if (!general) return;

  for (let i = 0; i < QUESTION_BANK_BLOCKS.length; i++) {
    const b = QUESTION_BANK_BLOCKS[i];
    const existing = await db.questionBankTemplateBlock.findFirst({
      where: { directionId: general.id, sourceKey: b.id },
    });
    if (existing) continue;

    await db.questionBankTemplateBlock.create({
      data: {
        directionId: general.id,
        sourceKey: b.id,
        title: b.title,
        required: b.required,
        sortOrder: i,
        questions: {
          create: b.questions.map((q, j) => ({
            text: q.text,
            sortOrder: j,
            responseType: "text",
          })),
        },
      },
    });
  }
}
