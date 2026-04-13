import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { RegisterForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">Регистрация</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted))]">Создайте HR-аккаунт. Данные изолированы по пользователю.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-[hsl(var(--muted))]">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-[hsl(var(--accent))] underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
