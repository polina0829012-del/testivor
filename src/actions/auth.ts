"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(120).optional(),
});

export async function registerUser(formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) return { error: "Проверьте email и пароль (мин. 6 символов)." };
  const { email, password, name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return { error: "Пользователь с таким email уже есть." };
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
    },
  });
  return { ok: true as const };
}
