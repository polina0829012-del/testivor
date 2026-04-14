"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertVacancyOwner, requireUserId } from "@/actions/guards";

export async function createCandidate(vacancyId: string, formData: FormData) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const raw = String(formData.get("name") ?? "").trim();
  if (raw.length > 200) return { error: "Слишком длинное имя." };
  const c = await prisma.candidate.create({
    data: {
      vacancyId,
      name: raw,
      interviewers: {
        create: [{ name: "Интервьюер 1" }, { name: "Интервьюер 2" }],
      },
    },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const, id: c.id };
}

const interviewersSchema = z.array(z.string().min(1).max(120)).min(2).max(4);

export async function setInterviewers(candidateId: string, vacancyId: string, names: string[]) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const c = await prisma.candidate.findFirst({
    where: { id: candidateId, vacancyId },
  });
  if (!c) return { error: "Кандидат не найден." };
  const parsed = interviewersSchema.safeParse(names.map((n) => n.trim()).filter(Boolean));
  if (!parsed.success) return { error: "Нужно 2–4 интервьюера: по одному имени на строку." };

  const newNames = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const withScores = await tx.interviewer.findMany({
        where: { candidateId },
        orderBy: { id: "asc" },
        include: { protocol: { include: { scores: true } } },
      });

      if (newNames.length < withScores.length) {
        for (let i = newNames.length; i < withScores.length; i++) {
          const scoreCount = withScores[i].protocol?.scores?.length ?? 0;
          if (scoreCount > 0) throw new Error("CANNOT_REMOVE_HAS_SCORES");
        }
        for (let i = newNames.length; i < withScores.length; i++) {
          await tx.interviewer.delete({ where: { id: withScores[i].id } });
        }
      }

      const rows = await tx.interviewer.findMany({
        where: { candidateId },
        orderBy: { id: "asc" },
      });

      for (let i = 0; i < rows.length && i < newNames.length; i++) {
        if (rows[i].name !== newNames[i]) {
          await tx.interviewer.update({
            where: { id: rows[i].id },
            data: { name: newNames[i] },
          });
        }
      }

      for (let i = rows.length; i < newNames.length; i++) {
        await tx.interviewer.create({
          data: { candidateId, name: newNames[i] },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CANNOT_REMOVE_HAS_SCORES") {
      return {
        error:
          "Нельзя убрать интервьюера из списка, если у него уже есть оценки. Добавьте нового в конец списка (максимум 4 человека).",
      };
    }
    throw e;
  }

  revalidatePath(`/vacancies/${vacancyId}`);
  revalidatePath(`/vacancies/${vacancyId}/candidates/${candidateId}`);
  return { ok: true as const };
}

export async function setInterviewersFromForm(candidateId: string, vacancyId: string, formData: FormData) {
  const raw = String(formData.get("names") ?? "");
  const names = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return setInterviewers(candidateId, vacancyId, names);
}

export async function deleteCandidate(candidateId: string, vacancyId: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  await prisma.candidate.deleteMany({ where: { id: candidateId, vacancyId } });
  revalidatePath(`/vacancies/${vacancyId}`);
  return { ok: true as const };
}
