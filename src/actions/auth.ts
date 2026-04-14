"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(6),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
});

export async function registerUser(formData: FormData) {
  const rawName = formData.get("name");
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: typeof rawName === "string" ? rawName : undefined,
  });
  if (!parsed.success) return { error: "Проверьте email и пароль (мин. 6 символов)." };
  const { email, password, name } = parsed.data;
  const emailNorm = email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (exists) return { error: "Пользователь с таким email уже есть." };
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email: emailNorm,
      passwordHash,
      name: name ?? null,
    },
  });
  return { ok: true as const };
}
