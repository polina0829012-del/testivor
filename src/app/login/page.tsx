import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { LoginForm } from "./ui";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">Вход</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted))]">
        Демо после сида: <span className="font-mono text-xs">demo@demo.com</span> /{" "}
        <span className="font-mono text-xs">demo123</span>
      </p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-[hsl(var(--muted))]">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-[hsl(var(--accent))] underline">
          Регистрация
        </Link>
      </p>
      <Link href="/" className="mt-4 text-center text-sm text-[hsl(var(--muted))]">
        На главную
      </Link>
    </div>
  );
}
