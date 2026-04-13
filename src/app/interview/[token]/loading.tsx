export default function InterviewLoading() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-[min(100%,1440px)] flex-col justify-center px-4 py-16 sm:px-8 lg:px-10">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <p className="mt-8 text-sm text-[hsl(var(--muted))]">Загрузка формы протокола…</p>
    </div>
  );
}
