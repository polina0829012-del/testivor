"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertVacancyOwner, requireUserId, STALE_SESSION_PREFIX } from "@/actions/guards";
import { mergedVacancyProfile } from "@/lib/vacancy-profile";
import { z } from "zod";

function parseFormDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const vacancyFieldsSchema = z.object({
  title: z.string().min(1).max(200),
  level: z.string().min(1).max(120),
  /** Компетенции и пожелания к кандидату — единое поле (до 12k символов). */
  competencies: z.string().min(1).max(12000),
  recruiterInternalNote: z.string().max(4000).default(""),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  status: z.enum(["draft", "active", "on_hold", "closed"]),
  workFormat: z.enum(["", "office", "hybrid", "remote"]).catch(""),
});

export type CreateVacancyResult = { error: string } | { ok: true; id: string };

function authErrorFromCatch(e: unknown): string | null {
  if (!(e instanceof Error)) return null;
  if (e.message === "UNAUTHORIZED") return "Войдите в аккаунт.";
  if (e.message.startsWith(STALE_SESSION_PREFIX)) {
    return e.message.slice(STALE_SESSION_PREFIX.length).trim();
  }
  return null;
}

export async function createVacancy(formData: FormData): Promise<CreateVacancyResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    const msg = authErrorFromCatch(e);
    if (msg) return { error: msg };
    throw e;
  }
  const parsed = vacancyFieldsSchema.safeParse({
    title: formData.get("title"),
    level: formData.get("level"),
    competencies: formData.get("competencies"),
    recruiterInternalNote: formData.get("recruiterInternalNote") ?? "",
    priority: formData.get("priority") ?? "normal",
    status: formData.get("status") ?? "active",
    workFormat: formData.get("workFormat") ?? "",
  });
  if (!parsed.success) return { error: "Проверьте обязательные поля и формат данных." };

  const targetCloseDate = parseFormDate(formData.get("targetCloseDate"));

  const v = await prisma.vacancy.create({
    data: {
      userId,
      ...parsed.data,
      expectationsForCandidate: "",
      targetCloseDate,
    },
  });
  revalidatePath("/dashboard");
  return { ok: true as const, id: v.id };
}

export async function updateVacancyMeta(vacancyId: string, formData: FormData) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const parsed = vacancyFieldsSchema.safeParse({
    title: formData.get("title"),
    level: formData.get("level"),
    competencies: formData.get("competencies"),
    recruiterInternalNote: formData.get("recruiterInternalNote") ?? "",
    priority: formData.get("priority") ?? "normal",
    status: formData.get("status") ?? "active",
    workFormat: formData.get("workFormat") ?? "",
  });
  if (!parsed.success) return { error: "Некорректные данные." };
  const targetCloseDate = parseFormDate(formData.get("targetCloseDate"));
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: {
      ...parsed.data,
      expectationsForCandidate: "",
      targetCloseDate,
      planUpdatedAt: new Date(),
      ...(parsed.data.status !== "closed" ? { hiredCandidateId: null } : {}),
    },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function duplicateVacancy(vacancyId: string) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    const msg = authErrorFromCatch(e);
    if (msg) return { error: msg };
    throw e;
  }
  const v = await prisma.vacancy.findFirst({
    where: { id: vacancyId, userId },
    include: {
      blocks: { include: { questions: true } },
    },
  });
  if (!v) return { error: "Не найдено." };
  const profile = mergedVacancyProfile(v.competencies, v.expectationsForCandidate);
  const copy = await prisma.vacancy.create({
    data: {
      userId,
      title: `${v.title} (копия)`,
      level: v.level,
      competencies: profile,
      expectationsForCandidate: "",
      recruiterInternalNote: v.recruiterInternalNote,
      priority: v.priority,
      status: v.status,
      targetCloseDate: v.targetCloseDate,
      workFormat: v.workFormat,
      blocks: {
        create: v.blocks
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((b) => ({
            title: b.title,
            sortOrder: b.sortOrder,
            required: b.required,
            questions: {
              create: b.questions
                .sort((q1, q2) => q1.sortOrder - q2.sortOrder)
                .map((q) => ({
                  text: q.text,
                  sortOrder: q.sortOrder,
                  responseType: q.responseType,
                })),
            },
          })),
      },
    },
  });
  revalidatePath("/dashboard");
  return { ok: true as const, id: copy.id };
}

/** Закрыть вакансию и опционально зафиксировать кандидата на трудоустройство. */
export async function closeVacancyWithOptionalHire(vacancyId: string, formData: FormData) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  const raw = formData.get("hiredCandidateId");
  const candidateId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  if (candidateId) {
    const belongs = await prisma.candidate.findFirst({
      where: { id: candidateId, vacancyId },
      select: { id: true },
    });
    if (!belongs) {
      redirect(`/vacancies/${vacancyId}?closeVacancyError=invalid_candidate`);
    }
  }
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: {
      status: "closed",
      hiredCandidateId: candidateId,
      planUpdatedAt: new Date(),
    },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  revalidatePath("/dashboard");
  redirect(`/vacancies/${vacancyId}?saved=1`);
}

/** Вернуть закрытую вакансию в работу (сброс найма и статус «В работе»). */
export async function reopenVacancyToActive(vacancyId: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: {
      status: "active",
      hiredCandidateId: null,
      planUpdatedAt: new Date(),
    },
  });
  revalidatePath(`/vacancies/${vacancyId}`);
  revalidatePath("/dashboard");
  redirect(`/vacancies/${vacancyId}?saved=1`);
}

export async function deleteVacancy(vacancyId: string) {
  const userId = await requireUserId();
  await assertVacancyOwner(vacancyId, userId);
  await prisma.vacancy.delete({ where: { id: vacancyId } });
  revalidatePath("/dashboard");
  return { ok: true as const };
}
