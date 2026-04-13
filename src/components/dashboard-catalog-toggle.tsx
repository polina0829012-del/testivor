import Link from "next/link";

const seg =
  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--accent))]";

export function DashboardCatalogToggle({ mode }: { mode: "mine" | "all" }) {
  const active = "bg-[hsl(var(--accent))] text-white shadow-md shadow-[hsl(var(--accent))]/20";
  const idle =
    "text-[hsl(var(--muted))] hover:bg-black/[0.06] hover:text-[hsl(var(--foreground))] dark:hover:bg-white/[0.08]";
  return (
    <div
      className="inline-flex rounded-xl border border-black/[0.08] bg-black/[0.02] p-1 shadow-sm ring-1 ring-black/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:ring-white/[0.04]"
      role="tablist"
      aria-label="Каталог вакансий"
    >
      <Link
        href="/dashboard"
        className={`${seg} ${mode === "mine" ? active : idle}`}
        role="tab"
        aria-selected={mode === "mine"}
      >
        Мои вакансии
      </Link>
      <Link
        href="/dashboard?catalog=all"
        className={`${seg} ${mode === "all" ? active : idle}`}
        role="tab"
        aria-selected={mode === "all"}
      >
        Все вакансии
      </Link>
    </div>
  );
}
