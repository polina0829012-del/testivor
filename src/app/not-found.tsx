import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Страница не найдена</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Проверьте адрес или вернитесь на главную.
      </p>
      <Link
        href="/"
        className="mt-6 w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        На главную
      </Link>
    </div>
  );
}
