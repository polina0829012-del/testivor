"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    setPending(false);
    if (res?.error) {
      setError(
        "Не удалось войти. Проверьте email и пароль. Демо после сида: demo@demo.com и пароль demo123 (три цифры, без пробелов). " +
          "Если пароль точно верный — полностью перезапустите dev-сервер, откройте сайт снова и при необходимости удалите куки для localhost (или попробуйте окно инкогнито).",
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-black/10 bg-[hsl(var(--surface))] px-3 py-2 dark:border-white/10"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Пароль</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-black/10 bg-[hsl(var(--surface))] px-3 py-2 dark:border-white/10"
        />
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[hsl(var(--accent))] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
