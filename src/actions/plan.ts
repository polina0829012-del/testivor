"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertVacancyOwner, requireUserId } from "@/actions/guards";
import { QUESTION_BANK_BLOCKS } from "@/lib/question-bank";
import type { PlanFromAI } from "@/lib/ai";
import { parseQuestionResponseType } from "@/lib/plan-question-types";

async function hasScoresForVacancy(vacancyId: string) {
  const n = await prisma.blockScore.count({
    where: { planBlock: { vacancyId } },
  });
  return n > 0;
}

export async function toggleBlockRequired(blockId: string, vacancyId: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const block = await prisma.planBlock.findFirst({
    where: { id: blockId, vacancyId },
  });
  if (!block) return { error: "Блок не найден." };
  await prisma.planBlock.update({
    where: { id: blockId },
    data: { required: !block.required },
  });
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function addPlanBlock(vacancyId: string, title: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const max = await prisma.planBlock.aggregate({
    where: { vacancyId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;
  await prisma.planBlock.create({
    data: {
      vacancyId,
      title: title.trim() || "Новый блок",
      sortOrder,
      questions: { create: { text: "Новый вопрос", sortOrder: 0 } },
    },
  });
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

/** Одним сохранением обновить названия блоков и тексты вопросов (остальные действия — отдельные формы). */
export async function saveInterviewPlanContent(vacancyId: string, formData: FormData) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const blocks = await prisma.planBlock.findMany({
    where: { vacancyId },
    include: { questions: true },
    orderBy: { sortOrder: "asc" },
  });
  for (const b of blocks) {
    const title = String(formData.get(`blockTitle_${b.id}`) ?? b.title).trim() || "Блок";
    await prisma.planBlock.update({ where: { id: b.id }, data: { title } });
    for (const q of b.questions) {
      const text = String(formData.get(`questionText_${q.id}`) ?? q.text).trim() || "Вопрос";
      const rtRaw = String(formData.get(`questionResponseType_${q.id}`) ?? q.responseType ?? "text");
      const responseType = parseQuestionResponseType(rtRaw);
      await prisma.planQuestion.update({
        where: { id: q.id },
        data: { text, responseType },
      });
    }
  }
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function updatePlanBlockTitle(blockId: string, vacancyId: string, title: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  await prisma.planBlock.updateMany({
    where: { id: blockId, vacancyId },
    data: { title: title.trim() },
  });
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function deletePlanBlock(blockId: string, vacancyId: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const scoreCount = await prisma.blockScore.count({ where: { planBlockId: blockId } });
  if (scoreCount > 0) return { error: "Нельзя удалить блок: есть оценки в протоколах." };
  const hasAnswersInBlock = await prisma.planQuestion.findFirst({
    where: { blockId, answers: { some: {} } },
    select: { id: true },
  });
  if (hasAnswersInBlock)
    return { error: "Нельзя удалить блок: есть ответы по вопросам в протоколах." };
  await prisma.planBlock.delete({ where: { id: blockId } });
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function addQuestion(blockId: string, vacancyId: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const block = await prisma.planBlock.findFirst({ where: { id: blockId, vacancyId } });
  if (!block) return { error: "Блок не найден." };
  const max = await prisma.planQuestion.aggregate({
    where: { blockId },
    _max: { sortOrder: true },
  });
  await prisma.planQuestion.create({
    data: {
      blockId,
      text: "Новый вопрос",
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function updateQuestionText(
  questionId: string,
  vacancyId: string,
  text: string,
) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const q = await prisma.planQuestion.findFirst({
    where: { id: questionId, block: { vacancyId } },
  });
  if (!q) return { error: "Вопрос не найден." };
  await prisma.planQuestion.update({
    where: { id: questionId },
    data: { text: text.trim() },
  });
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function deleteQuestion(questionId: string, vacancyId: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const q = await prisma.planQuestion.findFirst({
    where: { id: questionId, block: { vacancyId } },
    select: {
      id: true,
      blockId: true,
      _count: { select: { answers: true } },
    },
  });
  if (!q) return { error: "Вопрос не найден." };
  if (q._count.answers > 0)
    return { error: "Нельзя удалить вопрос: уже есть ответы в протоколах." };
  const count = await prisma.planQuestion.count({ where: { blockId: q.blockId } });
  if (count <= 1) return { error: "В блоке должен остаться хотя бы один вопрос." };
  await prisma.planQuestion.delete({ where: { id: questionId } });
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

/** Добавить блоки в конец плана (можно при уже существующих протоколах — появятся новые блоки для дозаполнения). */
export async function appendPlanFromAI(vacancyId: string, plan: PlanFromAI) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  if (!plan.blocks.length) return { ok: true as const };
  const max = await prisma.planBlock.aggregate({
    where: { vacancyId },
    _max: { sortOrder: true },
  });
  let sortOrder = (max._max.sortOrder ?? -1) + 1;
  for (const b of plan.blocks) {
    await prisma.planBlock.create({
      data: {
        vacancyId,
        title: b.title,
        sortOrder: sortOrder++,
        required: b.required,
        questions: {
          create: b.questions.map((q, j) => ({
            text: q.text,
            sortOrder: j,
            responseType: q.responseType === "rating" ? "rating" : "text",
          })),
        },
      },
    });
  }
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function importQuestionBankBlocks(vacancyId: string, bankBlockIds: string[]) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const picked = QUESTION_BANK_BLOCKS.filter((b) => bankBlockIds.includes(b.id));
  if (picked.length === 0) return { error: "Выберите хотя бы один блок из банка." };
  const max = await prisma.planBlock.aggregate({
    where: { vacancyId },
    _max: { sortOrder: true },
  });
  let sortOrder = (max._max.sortOrder ?? -1) + 1;
  for (const b of picked) {
    await prisma.planBlock.create({
      data: {
        vacancyId,
        title: b.title,
        sortOrder: sortOrder++,
        required: b.required,
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
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}

export async function replacePlanFromAI(vacancyId: string, plan: PlanFromAI) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  if (await hasScoresForVacancy(vacancyId)) {
    return { error: "План нельзя заменить целиком: уже есть протоколы с оценками." };
  }
  await prisma.$transaction([
    prisma.planQuestion.deleteMany({
      where: { block: { vacancyId } },
    }),
    prisma.planBlock.deleteMany({ where: { vacancyId } }),
  ]);
  for (let i = 0; i < plan.blocks.length; i++) {
    const b = plan.blocks[i];
    await prisma.planBlock.create({
      data: {
        vacancyId,
        title: b.title,
        sortOrder: i,
        required: b.required,
        questions: {
          create: b.questions.map((q, j) => ({
            text: q.text,
            sortOrder: j,
            responseType: q.responseType === "rating" ? "rating" : "text",
          })),
        },
      },
    });
  }
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: { planUpdatedAt: new Date() },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}
