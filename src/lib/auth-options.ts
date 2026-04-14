import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** trustHost поддерживается рантаймом NextAuth; в @types/next-auth может отсутствовать в AuthOptions. */
export const authOptions = {
  /** Локально: не ломать вход, если открыли другой порт (3001, 3004) или 127.0.0.1 вместо localhost. */
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email;
        const passwordRaw = credentials?.password;
        if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") return null;
        const email = emailRaw.trim().toLowerCase();
        if (!email || !passwordRaw) return null;
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(passwordRaw, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
} as NextAuthOptions;
