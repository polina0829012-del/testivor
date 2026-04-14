import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/** Префикс для ошибки «jwt есть, пользователя в БД нет» (смена DATABASE_URL, новый сид и т.п.). */
export const STALE_SESSION_PREFIX = "STALE_SESSION:";

export async function requireUserId() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) throw new Error("UNAUTHORIZED");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    throw new Error(
      `${STALE_SESSION_PREFIX}В базе нет пользователя из вашей сессии. Выйдите из аккаунта и войдите снова — так бывает после смены подключения к базе или нового сида.`,
    );
  }
  return id;
}

export async function assertVacancyOwner(vacancyId: string, userId: string) {
  const v = await prisma.vacancy.findFirst({
    where: { id: vacancyId, userId },
  });
  if (!v) throw new Error("NOT_FOUND");
  return v;
}

export async function assertCandidateOwner(candidateId: string, userId: string) {
  const c = await prisma.candidate.findFirst({
    where: { id: candidateId, vacancy: { userId } },
    include: { vacancy: true },
  });
  if (!c) throw new Error("NOT_FOUND");
  return c;
}
