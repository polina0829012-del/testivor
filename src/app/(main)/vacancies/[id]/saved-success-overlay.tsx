"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function SavedSuccessOverlay({
  vacancyId,
  initiallyOpen,
}: {
  vacancyId: string;
  initiallyOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    setOpen(initiallyOpen);
  }, [initiallyOpen]);

  const dismiss = useCallback(() => {
    setOpen(false);
    router.replace(`/vacancies/${vacancyId}`, { scroll: false });
  }, [router, vacancyId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(dismiss, 3200);
    return () => clearTimeout(t);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Закрыть уведомление"
        onClick={dismiss}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-emerald-500/35 bg-[hsl(var(--surface))] p-6 text-center shadow-xl ring-1 ring-black/[0.06] dark:border-emerald-400/30 dark:ring-white/[0.08]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-success-title"
      >
        <p id="saved-success-title" className="text-base font-semibold text-[hsl(var(--foreground))]">
          Данные успешно сохранены
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
