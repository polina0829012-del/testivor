"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="min-h-9 shrink-0 touch-manipulation rounded-lg border border-black/10 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Выйти
    </button>
  );
}
