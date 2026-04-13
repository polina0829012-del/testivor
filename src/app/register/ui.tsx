"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerUser } from "@/actions/auth";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await registerUser(fd);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.push("/login?registered=1");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium">Имя</label>
        <input
          name="name"
          className="mt-1 w-full rounded-lg border border-black/10 bg-[hsl(var(--surface))] px-3 py-2 dark:border-white/10"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-black/10 bg-[hsl(var(--surface))] px-3 py-2 dark:border-white/10"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Пароль (мин. 6)</label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          className="mt-1 w-full rounded-lg border border-black/10 bg-[hsl(var(--surface))] px-3 py-2 dark:border-white/10"
        />
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[hsl(var(--accent))] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Создание…" : "Создать аккаунт"}
      </button>
    </form>
  );
}
