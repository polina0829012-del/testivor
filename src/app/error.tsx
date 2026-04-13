"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Что-то пошло не так</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Попробуйте снова. Если ошибка повторяется — обновите страницу или загляните в консоль терминала с <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npm run dev</code>.
      </p>
      {process.env.NODE_ENV === "development" && error.message ? (
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error.message}
        </pre>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Повторить
      </button>
    </div>
  );
}
