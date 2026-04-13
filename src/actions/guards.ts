import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function requireUserId() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) throw new Error("UNAUTHORIZED");
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
