import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { averageRatingForBlock, blockHasRatingQuestions, effectiveBlockOverall } from "@/lib/block-scores";
import { computeDiscrepancies, type Discrepancy } from "@/lib/discrepancies";
import { meanOverallFromBlockScoreRows } from "@/lib/overall-block-score-agg";
import { candidateDisplayName, candidateReadiness } from "@/lib/stats";
import { getRequestOrigin } from "@/lib/app-origin";
import {
  recommendationChipClassName,
  recommendationLabelRu,
  recommendationStructured,
} from "@/lib/recommendation-labels";
import { parseQuestionResponseType } from "@/lib/plan-question-types";
import { AiButtons, CollapsibleProtocolCard, CopySummaryButton, InterviewersForm } from "./candidate-client";

/** Дольше ожидание ответа от API модели на Vercel / в проде (локально обычно не ограничивает). */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export default async function CandidatePage({
  params,
}: {
  params: { id: string; cid: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const c = await prisma.candidate.findFirst({
    where: { id: params.cid, vacancyId: params.id, vacancy: { userId: session.user.id } },
    include: {
      vacancy: {
        include: {
          blocks: {
            orderBy: { sortOrder: "asc" },
            include: { questions: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      interviewers: {
        include: {
          protocol: {
            include: {
              scores: { include: { planBlock: true } },
              questionAnswers: { include: { planQuestion: true } },
            },
          },
        },
      },
    },
  });
  if (!c) notFound();

  const candidateBlockScoreRows = await prisma.blockScore.findMany({
    where: { protocol: { interviewer: { candidateId: c.id } } },
    select: { score: true },
  });
  const avgScore = meanOverallFromBlockScoreRows(candidateBlockScoreRows);

  const v = c.vacancy;
  const blocks = v.blocks;
  const readiness = candidateReadiness(c, blocks.length);
  const protocols = c.interviewers
    .filter((i) => (i.protocol?.scores?.length ?? 0) > 0)
    .map((i) => ({
      interviewerName: i.name,
        scores:
        (i.protocol?.scores ?? []).map((s) => ({
          planBlockId: s.planBlockId,
          overallScore: effectiveBlockOverall(s),
          rubricDerivedScore: s.score,
        })),
    }));
  const discCalc = computeDiscrepancies(
    blocks.map((b) => ({
      id: b.id,
      title: b.title,
      hasRatingQuestions: blockHasRatingQuestions(b.questions),
    })),
    protocols,
  );

  let summary: Record<string, unknown> | null = null;
  if (c.summaryJson) {
    try {
      summary = JSON.parse(c.summaryJson) as Record<string, unknown>;
    } catch {
      summary = null;
    }
  }

  type StoredDiscrepanciesData = {
    discrepancies?: Discrepancy[];
    narrative?: {
      explanations?: { blockTitle: string; text: string }[];
      tip?: string;
    } | null;
    /** Сохраняется при запуске «AI: сводка», если протоколов с оценками меньше двух */
    discrepancyNotice?: string | null;
  };

  let discStored: StoredDiscrepanciesData | null = null;
  if (c.discrepanciesJson) {
    try {
      discStored = JSON.parse(c.discrepanciesJson) as StoredDiscrepanciesData;
    } catch {
      discStored = null;
    }
  }

  const summaryText = summary
    ? [
        `Кандидат: ${candidateDisplayName(c.name)}`,
        `Средний балл по общим оценкам блоков (протоколы): ${avgScore != null ? `${avgScore}/5` : "—"}`,
        `Общий скор (ИИ): ${String(summary.overallScore ?? "—")}`,
        `Рекомендация: ${recommendationLabelRu(summary.recommendation)}`,
        `Сильные стороны: ${Array.isArray(summary.strengths) ? (summary.strengths as string[]).join("; ") : ""}`,
        `Риски: ${Array.isArray(summary.risks) ? (summary.risks as string[]).join("; ") : ""}`,
      ].join("\n")
    : avgScore != null
      ? [
          `Кандидат: ${candidateDisplayName(c.name)}`,
          `Средний балл по общим оценкам блоков (протоколы): ${avgScore}/5`,
        ].join("\n")
      : "";

  const recSignal = recommendationStructured(summary?.recommendation);
  const readinessPct =
    readiness.total > 0 ? Math.min(100, Math.round((readiness.done / readiness.total) * 100)) : 0;

  let discSignalTitle: string;
  let discSignalHint: string;
  if (readiness.done < 2) {
    discSignalTitle = "Мало данных";
    discSignalHint = "Для сравнения интервьюеров нужны ≥2 полных протокола.";
  } else if (discCalc.length > 0) {
    const n = discCalc.length;
    const blockWord =
      n % 10 === 1 && n % 100 !== 11 ? "блок" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "блока" : "блоков";
    discSignalTitle = `Есть расхождения · ${n} ${blockWord}`;
    discSignalHint = "Разброс общей оценки по блоку больше 2 баллов.";
  } else {
    discSignalTitle = "Расхождений нет";
    discSignalHint = "По общим оценкам блоков разброс в пределах нормы.";
  }

  const appOrigin = getRequestOrigin();

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/vacancies/${v.id}`} className="text-sm text-[hsl(var(--muted))] hover:underline">
          ← {v.title}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{candidateDisplayName(c.name)}</h1>
        <section
          className="mt-4 rounded-xl border border-black/15 bg-black/[0.03] p-4 dark:border-white/15 dark:bg-white/[0.04]"
          aria-label="Сводные сигналы по кандидату"
        >
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Быстрый обзор</h2>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted))]">
            Готовность протоколов, расхождения интервьюеров, рекомендация ИИ и средний балл по общим оценкам блоков.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Готовность
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">
              {readiness.done}/{readiness.total}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-500/75 dark:bg-emerald-400/70"
                style={{ width: `${readinessPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">
              {readiness.complete
                ? "Все интервьюеры сдали протоколы с оценками по каждому блоку плана."
                : "Считается готовым протокол с оценками по всем блокам вакансии."}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Расхождения
            </p>
            <p className="mt-1 text-base font-semibold leading-snug text-[hsl(var(--foreground))]">
              {discSignalTitle}
            </p>
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">{discSignalHint}</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Рекомендация ИИ
            </p>
            <p className="mt-2">
              <span
                className={`inline-flex max-w-full rounded-lg border px-2.5 py-1 text-sm font-semibold ${recommendationChipClassName(recSignal.code)}`}
              >
                {recSignal.shortLabel}
              </span>
            </p>
            <p className="mt-2 text-xs leading-snug text-[hsl(var(--muted))]">{recSignal.longLabel}</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
              Средний балл
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">
              {avgScore != null ? `${avgScore}/5` : "—"}
            </p>
            <p className="mt-2 text-xs text-[hsl(var(--muted))]">
              Среднее по всем общим оценкам блоков (1–5) во всех сданных протоколах интервьюеров.
            </p>
          </div>
        </div>
        </section>
      </div>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Интервьюеры и ссылки</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted))]">
          От 2 до 4 интервьюеров: у каждого своё поле имени и напротив — персональная ссылка. «Добавить
          интервьюера» добавляет строку (не больше четырёх). Удалить строку можно только если у этого
          интервьюера ещё нет оценок в протоколе и в списке останется не меньше двух человек.
        </p>
        <InterviewersForm
          key={c.interviewers.map((i) => `${i.id}:${i.name}`).join("|")}
          candidateId={c.id}
          vacancyId={v.id}
          initialInterviewers={c.interviewers.map((i) => ({
            id: i.id,
            name: i.name,
            url: `${appOrigin}/interview/${i.inviteToken}`,
            protocolDone: Boolean(i.protocol?.submittedAt && (i.protocol.scores?.length ?? 0) > 0),
            hasScores: (i.protocol?.scores?.length ?? 0) > 0,
          }))}
        />
      </section>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Протоколы</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted))]">
          У каждого интервьюера своя карточка — нажмите на заголовок, чтобы свернуть или развернуть содержимое.
        </p>
        <div className="mt-5 flex flex-col gap-5">
          {c.interviewers.map((i, interviewerIdx) => {
            const hasProtocol = Boolean((i.protocol?.scores?.length ?? 0) > 0);
            const submittedAt = i.protocol?.submittedAt
              ? new Date(i.protocol.submittedAt).toLocaleString("ru-RU")
              : null;
            const submittedAtIso = i.protocol?.submittedAt
              ? new Date(i.protocol.submittedAt).toISOString()
              : null;
            return (
              <CollapsibleProtocolCard
                key={i.id}
                interviewerIndex={interviewerIdx}
                name={i.name}
                hasProtocol={hasProtocol}
                submittedAtIso={submittedAtIso}
                submittedAtLabel={submittedAt}
              >
                {!hasProtocol ? (
                  <p className="text-sm text-[hsl(var(--muted))]">
                    Протокол ещё не заполнен или не отправлен по ссылке выше.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {(i.protocol?.scores ?? []).map((s) => {
                      const blockMeta = blocks.find((b) => b.id === s.planBlockId);
                      const qlist = blockMeta?.questions ?? [];
                      const answers = i.protocol?.questionAnswers ?? [];
                      const avgFromQuestions = averageRatingForBlock(qlist, answers);
                      return (
                        <li
                          key={s.id}
                          className="rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]"
                        >
                          <p>
                            <span className="font-medium text-[hsl(var(--foreground))]">{s.planBlock.title}</span>
                            {" "}
                            · общая оценка блока: <strong>{effectiveBlockOverall(s)}/5</strong>
                            {avgFromQuestions != null ? (
                              <>
                                {" "}
                                · средний балл по пунктам: <strong>{avgFromQuestions}/5</strong>
                              </>
                            ) : null}
                            {s.notes?.trim() ? (
                              <>
                                {" "}
                                — {s.notes}
                              </>
                            ) : null}
                          </p>
                          {qlist.length > 0 ? (
                            <ul className="mt-2 space-y-1.5 border-t border-black/10 pt-2 text-xs dark:border-white/10">
                              {qlist.map((q) => {
                                const a = answers.find((x) => x.planQuestionId === q.id);
                                const rt = parseQuestionResponseType(q.responseType);
                                const line =
                                  rt === "rating"
                                    ? `${a?.scoreAnswer ?? "—"}/5`
                                    : a?.textAnswer?.trim() || "—";
                                return (
                                  <li key={q.id}>
                                    <span className="text-[hsl(var(--muted))]">· {q.text}</span>
                                    <br />
                                    <span className="text-[hsl(var(--foreground))]">{line}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CollapsibleProtocolCard>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">AI-сводка и расхождения</h2>
          <div className="flex flex-wrap gap-2">
            <AiButtons candidateId={c.id} vacancyId={v.id} />
            {summaryText ? <CopySummaryButton text={summaryText} /> : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-[hsl(var(--muted))]">
          Кнопка «AI: сводка» строит сводку по протоколам и одновременно пересчитывает расхождения между
          интервьюерами (если заполнено меньше двух протоколов с оценками — анализ расхождений пропускается с
          пояснением).
        </p>
        {c.summaryUpdatedAt ? (
          <p className="mt-2 text-xs text-[hsl(var(--muted))]">
            Обновлено: {new Date(c.summaryUpdatedAt).toLocaleString("ru-RU")}
          </p>
        ) : null}

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,22rem)] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <p>
                <span className="text-[hsl(var(--muted))]">Средний балл по блокам (протоколы):</span>{" "}
                <strong className="tabular-nums text-[hsl(var(--foreground))]">
                  {avgScore != null ? `${avgScore}/5` : "—"}
                </strong>
              </p>
              <p className="mt-1 text-xs leading-snug text-[hsl(var(--muted))]">
                Среднее всех общих оценок блоков во всех сданных протоколах. Отличается от «общего скора» ниже — тот задаёт
                модель по тексту сводки.
              </p>
            </div>
            {!summary ? (
              <p className="mt-4 text-sm text-[hsl(var(--muted))]">
                Нажмите «AI: сводка», чтобы сгенерировать сводку и обновить анализ расхождений.
              </p>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="text-[hsl(var(--muted))]">Общий скор (ИИ):</span>{" "}
                  {String(summary.overallScore ?? "—")}
                </p>
                <p>
                  <span className="text-[hsl(var(--muted))]">Рекомендация:</span>{" "}
                  <span className="font-semibold">{recommendationLabelRu(summary.recommendation)}</span>
                </p>
                <div>
                  <p className="text-[hsl(var(--muted))]">Сильные стороны</p>
                  <ul className="list-disc pl-5">
                    {(Array.isArray(summary.strengths) ? summary.strengths : []).map((x, i) => (
                      <li key={i}>{String(x)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[hsl(var(--muted))]">Риски</p>
                  <ul className="list-disc pl-5">
                    {(Array.isArray(summary.risks) ? summary.risks : []).map((x, i) => (
                      <li key={i}>{String(x)}</li>
                    ))}
                  </ul>
                </div>
                {Array.isArray(summary.evidenceNotes) && summary.evidenceNotes.length > 0 ? (
                  <div>
                    <p className="text-[hsl(var(--muted))]">Опоры из заметок</p>
                    <ul className="list-disc pl-5">
                      {(summary.evidenceNotes as string[]).map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <aside
            className="min-w-0 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03] lg:sticky lg:top-4 lg:max-h-[min(70vh,calc(100dvh-6rem))] lg:overflow-y-auto lg:overscroll-y-contain"
            aria-labelledby="ai-discrepancies-heading"
          >
            <h3 id="ai-discrepancies-heading" className="text-base font-semibold">
              Расхождения (&gt; 2 балла)
            </h3>
            <p className="mt-1 text-xs text-[hsl(var(--muted))]">
              Сравнивается <strong>общая оценка блока</strong> (1–5) у разных интервьюеров. При балльных пунктах в блоке
              рядом показывается среднее по рубрике.
            </p>
            {readiness.done < 2 ? (
              <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
                {discStored?.discrepancyNotice ??
                  "Для анализа расхождений нужны заполненные протоколы минимум от двух интервьюеров. Сейчас готово меньше двух."}
              </p>
            ) : discCalc.length === 0 ? (
              <p className="mt-3 text-sm text-[hsl(var(--muted))]">
                Нет расхождений по правилу: разброс общей оценки по блоку между интервьюерами не превышает 2 баллов.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {discCalc.map((d) => (
                  <li key={d.planBlockId} className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                    <strong>{d.blockTitle}</strong>: разброс {d.minScore}–{d.maxScore} (Δ{d.diff})
                    <ul className="mt-1 text-[hsl(var(--muted))]">
                      {d.byInterviewer.map((x) => (
                        <li key={x.name}>
                          {x.name}: общая {x.overallScore}/5
                          {x.rubricDerivedScore != null ? (
                            <span className="text-[hsl(var(--muted))]">
                              {" "}
                              (по пунктам: {x.rubricDerivedScore}/5)
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {readiness.done >= 2 && discStored?.narrative?.explanations?.length ? (
              <div className="mt-3 space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
                <p className="text-sm font-medium">Комментарий AI по расхождениям</p>
                {discStored.narrative.explanations.map((e) => (
                  <p key={e.blockTitle} className="text-sm">
                    <strong>{e.blockTitle}:</strong> {e.text}
                  </p>
                ))}
                {discStored.narrative.tip ? (
                  <p className="text-sm text-[hsl(var(--muted))]">Совет: {discStored.narrative.tip}</p>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
