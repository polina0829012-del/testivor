#!/usr/bin/env node
/**
 * Проверка пароля против хеша в БД (локально, для отладки).
 * npm run db:test-password -- demo@demo.com demo123
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = process.argv[2];
const password = process.argv[3];
if (!email || password === undefined) {
  console.log("Использование: node scripts/test-password.mjs <email> <password>");
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
if (!user) {
  console.log("Пользователь не найден:", email.trim().toLowerCase());
  await prisma.$disconnect();
  process.exit(2);
}
const ok = await bcrypt.compare(password, user.passwordHash);
console.log("Email:", user.email);
console.log("bcrypt.compare:", ok ? "OK" : "НЕВЕРНО");
console.log("Префикс хеша:", user.passwordHash.slice(0, 15) + "…");
await prisma.$disconnect();
