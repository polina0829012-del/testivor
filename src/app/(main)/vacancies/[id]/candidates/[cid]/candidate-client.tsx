"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setInterviewersFromForm } from "@/actions/candidates";
import { runDiscrepancyAI, runRegenerateRisks, runSummarizeAI } from "@/actions/ai-run";

function isLikelyFetchFailure(e: unknown) {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return e.name === "TypeError" && m.includes("fetch");
}

export function InterviewersForm({
  candidateId,
  vacancyId,
  defaultNamesText,
}: {
  candidateId: string;
  vacancyId: string;
  defaultNamesText: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await setInterviewersFromForm(candidateId, vacancyId, fd);
          if (r && "error" in r && r.error) {
            setError(r.error);
            return;
          }
          setOk(true);
          router.refresh();
        });
      }}
    >
      <textarea
        name="names"
        rows={5}
        defaultValue={defaultNamesText}
        className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-sm dark:border-white/10"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Сохранение…" : "Сохранить состав"}
      </button>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {ok ? <p className="text-sm text-green-700 dark:text-green-400">Сохранено. Новые ссылки ниже.</p> : null}
    </form>
  );
}

export function AiButtons({
  candidateId,
  vacancyId,
}: {
  candidateId: string;
  vacancyId: string;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-lg bg-[hsl(var(--accent))] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => {
            setErr(null);
            start(async () => {
              try {
                const r = await runSummarizeAI(candidateId, vacancyId);
                if ("error" in r && r.error) setErr(r.error);
              } catch (e) {
                setErr(
                  isLikelyFetchFailure(e)
                    ? "Запрос к серверу оборвался (часто: долгий ответ ИИ, перезапуск dev-сервера, сеть или блокировка API). Подождите и повторите; проверьте .env и терминал `npm run dev`."
                    : e instanceof Error
                      ? e.message
                      : "Ошибка запроса",
                );
              }
              router.refresh();
            });
          }}
        >
          AI: сводка
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          onClick={() => {
            setErr(null);
            start(async () => {
              try {
                const r = await runDiscrepancyAI(candidateId, vacancyId);
                if ("error" in r && r.error) setErr(r.error);
              } catch (e) {
                setErr(
                  isLikelyFetchFailure(e)
                    ? "Запрос к серверу оборвался. Подождите и повторите; проверьте терминал сервера и сеть."
                    : e instanceof Error
                      ? e.message
                      : "Ошибка запроса",
                );
              }
              router.refresh();
            });
          }}
        >
          AI: расхождения
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          onClick={() => {
            setErr(null);
            start(async () => {
              try {
                const r = await runRegenerateRisks(candidateId, vacancyId);
                if ("error" in r && r.error) setErr(r.error);
              } catch (e) {
                setErr(
                  isLikelyFetchFailure(e)
                    ? "Запрос к серверу оборвался. Подождите и повторите."
                    : e instanceof Error
                      ? e.message
                      : "Ошибка запроса",
                );
              }
              router.refresh();
            });
          }}
        >
          Перегенерировать риски
        </button>
      </div>
      {err ? <p className="text-xs text-red-600 dark:text-red-400">{err}</p> : null}
      <p className="text-xs text-[hsl(var(--muted))]">
        Нужны OPENAI_API_KEY и при зеркале — OPENAI_BASE_URL в .env. Запрос к модели может занимать до ~2 минут.
      </p>
    </div>
  );
}

export function CopySummaryButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
    >
      {ok ? "Скопировано" : "Копировать сводку"}
    </button>
  );
}
