import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo123", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@demo.com" },
    update: {},
    create: {
      email: "demo@demo.com",
      passwordHash,
      name: "Демо HR",
    },
  });

  const existing = await prisma.vacancy.findFirst({
    where: { userId: user.id, title: "Frontend-разработчик" },
  });
  if (existing) {
    console.log("Seed already applied (vacancy exists).");
    return;
  }

  const vacancy = await prisma.vacancy.create({
    data: {
      userId: user.id,
      title: "Frontend-разработчик",
      level: "Middle+",
      competencies: "React, TypeScript, архитектура UI, коммуникация",
      blocks: {
        create: [
          {
            title: "Технические навыки",
            sortOrder: 0,
            required: true,
            questions: {
              create: [
                { text: "Опишите опыт с React Server Components.", sortOrder: 0 },
                { text: "Как вы подходите к типизации крупного модуля?", sortOrder: 1 },
              ],
            },
          },
          {
            title: "Системное мышление",
            sortOrder: 1,
            required: true,
            questions: {
              create: [
                { text: "Пример рефакторинга легаси без остановки релизов.", sortOrder: 0 },
              ],
            },
          },
          {
            title: "Софт-скиллы",
            sortOrder: 2,
            required: false,
            questions: {
              create: [
                { text: "Конфликт в команде: как действовали?", sortOrder: 0 },
              ],
            },
          },
        ],
      },
      candidates: {
        create: [
          {
            name: "Алексей Иванов",
            interviewers: {
              create: [
                { name: "Мария (Tech Lead)", inviteToken: "invite-demo-maria" },
                { name: "Олег (Engineering Manager)", inviteToken: "invite-demo-oleg" },
                { name: "Ирина (HR BP)", inviteToken: "invite-demo-irina" },
              ],
            },
          },
          {
            name: "Елена Смирнова",
            interviewers: {
              create: [
                { name: "Мария (Tech Lead)", inviteToken: "invite-demo2-maria" },
                { name: "Олег (Engineering Manager)", inviteToken: "invite-demo2-oleg" },
              ],
            },
          },
        ],
      },
    },
    include: { blocks: true, candidates: { include: { interviewers: true } } },
  });

  const blocks = [...vacancy.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const alex = vacancy.candidates.find((c) => c.name.includes("Алексей"))!;
  const elena = vacancy.candidates.find((c) => c.name.includes("Елена"))!;

  async function fillProtocols(
    candidateId: string,
    matrix: { token: string; scores: number[] }[],
  ) {
    const ivs = await prisma.interviewer.findMany({
      where: { candidateId },
    });
    for (const row of matrix) {
      const inv = ivs.find((i) => i.inviteToken === row.token);
      if (!inv) continue;
      const protocol = await prisma.protocol.create({
        data: {
          interviewerId: inv.id,
          submittedAt: new Date(),
          scores: {
            create: blocks.map((b, idx) => ({
              planBlockId: b.id,
              score: row.scores[idx] ?? 3,
              notes:
                idx === 0
                  ? "Сильная база React, обсудили хуки и производительность."
                  : idx === 1
                    ? "Архитектурные решения средние, мало примеров из продакшена."
                    : "Коммуникация уверенная, примеры по конфликтам поверхностные.",
            })),
          },
        },
      });
      void protocol;
    }
  }

  // Алексей: block0 scores 5,2,4 -> diff 3 on block0 between Maria and Oleg (example - we need to map tokens to scores)
  await fillProtocols(alex.id, [
    { token: "invite-demo-maria", scores: [5, 4, 4] },
    { token: "invite-demo-oleg", scores: [2, 3, 3] },
    { token: "invite-demo-irina", scores: [4, 4, 5] },
  ]);

  await fillProtocols(elena.id, [
    { token: "invite-demo2-maria", scores: [4, 4] },
    { token: "invite-demo2-oleg", scores: [4, 4] },
  ]);

  console.log("Seed OK. Login: demo@demo.com / demo123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
