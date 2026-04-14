"use client";

import { Check, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { setInterviewers } from "@/actions/candidates";
import { runSummarizeAI } from "@/actions/ai-run";

function isLikelyFetchFailure(e: unknown) {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return e.name === "TypeError" && m.includes("fetch");
}

export function CollapsibleProtocolCard({
  interviewerIndex,
  name,
  hasProtocol,
  submittedAtIso,
  submittedAtLabel,
  defaultOpen = true,
  children,
}: {
  interviewerIndex: number;
  name: string;
  hasProtocol: boolean;
  submittedAtIso: string | null;
  submittedAtLabel: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `interviewer-protocol-${interviewerIndex}`;
  const headerId = `interviewer-protocol-h-${interviewerIndex}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-black/[0.08] bg-[hsl(var(--surface))] shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.03] dark:border-white/[0.1] dark:shadow-none dark:ring-white/[0.05]">
      <button
        type="button"
        id={headerId}
        className="flex w-full flex-col gap-2 border-b border-black/10 bg-gradient-to-r from-[hsl(var(--accent))]/[0.12] via-[hsl(var(--accent))]/[0.05] to-transparent px-4 py-3.5 text-left transition-colors hover:from-[hsl(var(--accent))]/18 hover:via-[hsl(var(--accent))]/10 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:from-[hsl(var(--accent))]/18 dark:via-[hsl(var(--accent))]/8 dark:hover:from-[hsl(var(--accent))]/22 dark:hover:via-[hsl(var(--accent))]/12"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]/20 text-xs font-bold tabular-nums text-[hsl(var(--accent))] dark:bg-[hsl(var(--accent))]/25"
            aria-hidden
          >
            {interviewerIndex + 1}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-snug tracking-tight text-[hsl(var(--foreground))]">
              {name}
            </h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted))]">
              Протокол интервьюера
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {hasProtocol ? (
            <span className="inline-flex items-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100">
              Сдан
            </span>
          ) : (
            <span className="inline-flex items-center rounded-lg border border-black/10 bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[hsl(var(--muted))] dark:border-white/15 dark:bg-white/[0.06]">
              Нет данных
            </span>
          )}
          {submittedAtIso && submittedAtLabel ? (
            <time className="text-xs text-[hsl(var(--muted))]" dateTime={submittedAtIso}>
              Отправлено: {submittedAtLabel}
            </time>
          ) : null}
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-[hsl(var(--muted))] transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
        </div>
      </button>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={headerId}>
          <div className="p-4 pt-3">{children}</div>
        </div>
      ) : null}
    </article>
  );
}

export function CopyInviteLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* ignore — нет доступа к буферу */
        }
      }}
      className="inline-flex shrink-0 rounded-lg border border-black/15 p-2 text-[hsl(var(--muted))] transition hover:border-[hsl(var(--accent))]/40 hover:bg-black/[0.04] hover:text-[hsl(var(--foreground))] dark:border-white/15 dark:hover:bg-white/[0.06]"
      title={copied ? "Скопировано" : "Копировать ссылку"}
      aria-label={copied ? "Ссылка скопирована" : "Копировать ссылку в буфер обмена"}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

export type InterviewerFieldInitial = {
  id: string;
  name: string;
  url: string;
  protocolDone: boolean;
  hasScores: boolean;
};

type EditableRow = {
  clientKey: string;
  serverId: string | null;
  name: string;
  url: string | null;
  protocolDone: boolean;
  hasScores: boolean;
};

function toEditableRows(initial: InterviewerFieldInitial[]): EditableRow[] {
  if (initial.length === 0) {
    return [
      {
        clientKey: "seed-a",
        serverId: null,
        name: "",
        url: null,
        protocolDone: false,
        hasScores: false,
      },
      {
        clientKey: "seed-b",
        serverId: null,
        name: "",
        url: null,
        protocolDone: false,
        hasScores: false,
      },
    ];
  }
  return initial.map((r) => ({
    clientKey: r.id,
    serverId: r.id,
    name: r.name,
    url: r.url,
    protocolDone: r.protocolDone,
    hasScores: r.hasScores,
  }));
}

export function InterviewersForm({
  candidateId,
  vacancyId,
  initialInterviewers,
}: {
  candidateId: string;
  vacancyId: string;
  initialInterviewers: InterviewerFieldInitial[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRow[]>(() => toEditableRows(initialInterviewers));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function updateName(index: number, name: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, name } : r)));
  }

  function addRow() {
    setRows((prev) => {
      if (prev.length >= 4) return prev;
      return [
        ...prev,
        {
          clientKey: `new-${crypto.randomUUID()}`,
          serverId: null,
          name: "",
          url: null,
          protocolDone: false,
          hasScores: false,
        },
      ];
    });
    setOk(false);
  }

  function removeRow(index: number) {
    setRows((prev) => {
      if (prev.length <= 2) return prev;
      const row = prev[index];
      if (!row || row.hasScores) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setOk(false);
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const names = rows.map((r) => r.name.trim());
        if (names.some((n) => !n)) {
          setError("Заполните имя в каждой строке или удалите пустую.");
          return;
        }
        if (names.length < 2 || names.length > 4) {
          setError("Нужно от 2 до 4 интервьюеров.");
          return;
        }
        start(async () => {
          const r = await setInterviewers(candidateId, vacancyId, names);
          if (r && "error" in r && r.error) {
            setError(r.error);
            return;
          }
          setOk(true);
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div
            key={row.clientKey}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(200px,42%)] sm:items-stretch sm:gap-3"
          >
            <div className="flex min-h-[2.75rem] items-stretch gap-2">
              <label className="sr-only" htmlFor={`interviewer-name-${row.clientKey}`}>
                Имя интервьюера {idx + 1}
              </label>
              <input
                id={`interviewer-name-${row.clientKey}`}
                type="text"
                value={row.name}
                onChange={(e) => updateName(idx, e.target.value)}
                maxLength={120}
                autoComplete="name"
                placeholder={`Интервьюер ${idx + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20"
              />
              {!row.hasScores && rows.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-black/15 px-2.5 text-[hsl(var(--muted))] transition hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-white/15 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                  title="Удалить строку"
                  aria-label={`Удалить интервьюера ${idx + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="flex min-h-[2.75rem] items-center gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-2 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              {row.url ? (
                <>
                  <div className="min-w-0 flex-1">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs text-[hsl(var(--accent))] underline decoration-[hsl(var(--accent))]/40 underline-offset-2 hover:decoration-[hsl(var(--accent))]"
                    >
                      {row.url}
                    </a>
                  </div>
                  <CopyInviteLinkButton url={row.url} />
                  <span
                    className={`shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide ${
                      row.protocolDone
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-[hsl(var(--muted))]"
                    }`}
                  >
                    {row.protocolDone ? "Сдан" : "Ждём"}
                  </span>
                </>
              ) : (
                <p className="text-xs leading-snug text-[hsl(var(--muted))]">
                  Ссылка появится после «Сохранить состав»
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= 4 || pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/20"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Добавить интервьюера
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-black/15 bg-[hsl(var(--surface))] px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-white/20"
        >
          {pending ? "Сохранение…" : "Сохранить состав"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {ok ? (
        <p className="text-sm font-medium text-green-700 dark:text-green-400" role="status">
          Состав сохранён, ссылки обновлены.
        </p>
      ) : null}
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
      </div>
      {err ? <p className="text-xs text-red-600 dark:text-red-400">{err}</p> : null}
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
