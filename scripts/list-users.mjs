#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
console.log(`Всего пользователей: ${users.length}\n`);
for (const u of users) {
  console.log(
    `- ${u.email} | имя: ${u.name ?? "—"} | id: ${u.id} | создан: ${u.createdAt.toISOString()}`,
  );
}
await prisma.$disconnect();
