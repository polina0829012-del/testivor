import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { averageRatingForBlock, blockHasRatingQuestions } from "@/lib/block-scores";
import { computeDiscrepancies } from "@/lib/discrepancies";
import { candidateDisplayName, candidateReadiness } from "@/lib/stats";
import { getRequestOrigin } from "@/lib/app-origin";
import { recommendationLabelRu } from "@/lib/recommendation-labels";
import { parseQuestionResponseType } from "@/lib/plan-question-types";
import { AiButtons, CopySummaryButton, InterviewersForm } from "./candidate-client";

/** Дольше ожидание ответа от API модели на Vercel / в проде (локально обычно не ограничивает). */
export const maxDuration = 120;

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

  const v = c.vacancy;
  const blocks = v.blocks;
  const readiness = candidateReadiness(c, blocks.length);
  const protocols = c.interviewers
    .filter((i) => i.protocol && i.protocol.scores.length > 0)
    .map((i) => ({
      interviewerName: i.name,
      scores:
        i.protocol?.scores.map((s) => ({
          planBlockId: s.planBlockId,
          score: s.score,
        })) ?? [],
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

  let discStored: {
    discrepancies?: typeof discCalc;
    narrative?: { explanations?: { blockTitle: string; text: string }[]; tip?: string } | null;
  } | null = null;
  if (c.discrepanciesJson) {
    try {
      discStored = JSON.parse(c.discrepanciesJson) as typeof discStored;
    } catch {
      discStored = null;
    }
  }

  const summaryText = summary
    ? [
        `Кандидат: ${candidateDisplayName(c.name)}`,
        `Общий скор: ${String(summary.overallScore ?? "—")}`,
        `Рекомендация: ${recommendationLabelRu(summary.recommendation)}`,
        `Сильные стороны: ${Array.isArray(summary.strengths) ? (summary.strengths as string[]).join("; ") : ""}`,
        `Риски: ${Array.isArray(summary.risks) ? (summary.risks as string[]).join("; ") : ""}`,
      ].join("\n")
    : "";

  const namesDefault = c.interviewers.map((i) => i.name).join("\n");
  const appOrigin = getRequestOrigin();

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/vacancies/${v.id}`} className="text-sm text-[hsl(var(--muted))] hover:underline">
          ← {v.title}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{candidateDisplayName(c.name)}</h1>
        <p className="text-sm text-[hsl(var(--muted))]">
          Готовность протоколов: {readiness.done}/{readiness.total}
          {readiness.complete ? " · все сданы" : ""}
        </p>
      </div>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Интервьюеры и ссылки</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted))]">
          2–4 человека, по одному имени на строку. Порядок строк совпадает с интервьюерами (по дате добавления).
          Можно добавить новую строку в конец, даже если у других уже есть протокол. Удалить из списка можно
          только того, у кого ещё нет оценок.
        </p>
        <InterviewersForm
          key={c.interviewers.map((i) => `${i.id}:${i.name}`).join("|")}
          candidateId={c.id}
          vacancyId={v.id}
          defaultNamesText={namesDefault}
        />
        <ul className="mt-3 space-y-1.5 text-sm">
          {c.interviewers.map((i) => {
            const url = `${appOrigin}/interview/${i.inviteToken}`;
            const done = Boolean(i.protocol?.submittedAt && (i.protocol.scores.length ?? 0) > 0);
            return (
              <li key={i.id} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                <div className="font-medium">{i.name}</div>
                <div className="mt-1 break-all text-xs text-[hsl(var(--muted))]">{url}</div>
                <div className="mt-1 text-xs">{done ? "Протокол отправлен" : "Ожидаем протокол"}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Протоколы</h2>
        <div className="mt-3 space-y-3">
          {c.interviewers.map((i) => (
            <div key={i.id}>
              <p className="font-medium">{i.name}</p>
              {!i.protocol || i.protocol.scores.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted))]">Нет данных</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {i.protocol.scores.map((s) => {
                    const blockMeta = blocks.find((b) => b.id === s.planBlockId);
                    const qlist = blockMeta?.questions ?? [];
                    const answers = i.protocol?.questionAnswers ?? [];
                    const avgFromQuestions = averageRatingForBlock(qlist, answers);
                    return (
                      <li key={s.id} className="rounded-lg border border-black/5 p-2 dark:border-white/10">
                        <p>
                          <span className="font-medium text-[hsl(var(--foreground))]">{s.planBlock.title}</span>
                          {avgFromQuestions != null ? (
                            <>
                              {" "}
                              · средний балл по пунктам блока: <strong>{avgFromQuestions}/5</strong>
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
                          <ul className="mt-2 space-y-1 border-t border-black/10 pt-2 text-xs dark:border-white/10">
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
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Расхождения (&gt; 2 балла)</h2>
        <p className="mt-1 text-xs text-[hsl(var(--muted))]">
          По блокам, где есть балльные вопросы: сравнивается среднее по пунктам блока у разных интервьюеров.
        </p>
        {discCalc.length === 0 ? (
          <p className="mt-3 text-sm text-[hsl(var(--muted))]">Нет расхождений по правилу.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {discCalc.map((d) => (
              <li key={d.planBlockId} className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                <strong>{d.blockTitle}</strong>: разброс {d.minScore}–{d.maxScore} (Δ{d.diff})
                <ul className="mt-1 text-[hsl(var(--muted))]">
                  {d.byInterviewer.map((x) => (
                    <li key={x.name}>
                      {x.name}: {x.score}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {discStored?.narrative?.explanations?.length ? (
          <div className="mt-3 space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
            <p className="text-sm font-medium">Комментарий AI</p>
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
      </section>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">AI-сводка</h2>
          <div className="flex flex-wrap gap-2">
            <AiButtons candidateId={c.id} vacancyId={v.id} />
            {summaryText ? <CopySummaryButton text={summaryText} /> : null}
          </div>
        </div>
        {c.summaryUpdatedAt ? (
          <p className="mt-2 text-xs text-[hsl(var(--muted))]">
            Обновлено: {new Date(c.summaryUpdatedAt).toLocaleString("ru-RU")}
          </p>
        ) : null}
        {!summary ? (
          <p className="mt-4 text-sm text-[hsl(var(--muted))]">Нажмите «AI: сводка», чтобы сгенерировать.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              <span className="text-[hsl(var(--muted))]">Общий скор:</span> {String(summary.overallScore ?? "—")}
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
      </section>
    </div>
  );
}
