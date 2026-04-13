"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 rounded-lg border border-transparent"
        aria-hidden
      />
    );
  }
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label="Тема"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] shadow-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
