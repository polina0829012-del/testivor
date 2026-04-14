"use server";

import { revalidatePath } from "next/cache";
import { APIError, AuthenticationError, RateLimitError } from "openai";
import { prisma } from "@/lib/prisma";
import { assertCandidateOwner, requireUserId } from "@/actions/guards";
import {
  compareAllCandidates,
  generateInterviewPlan,
  narrateDiscrepancies,
  suggestInterviewPlanAdditions,
  summarizeCandidate,
} from "@/lib/ai";
import { blockHasRatingQuestions, effectiveBlockOverall } from "@/lib/block-scores";
import { aggregateVacancyBlockOverallScores } from "@/lib/overall-block-score-agg";
import { candidateAvgScore, candidateDisplayName, candidateReadiness } from "@/lib/stats";
import { computeDiscrepancies } from "@/lib/discrepancies";
import { appendPlanFromAI, replacePlanFromAI } from "@/actions/plan";
import { mergedVacancyProfile } from "@/lib/vacancy-profile";
import { WORK_FORMAT_LABEL } from "@/lib/vacancy-labels";

function formatLlmApiError(e: APIError): string {
  if (e instanceof AuthenticationError || e.status === 401) {
    return "Доступ к API модели отклонён (неверный или просроченный ключ). Проверьте OPENAI_API_KEY или OPENROUTER_API_KEY.";
  }
  if (e instanceof RateLimitError || e.status === 429) {
    return "Превышен лимит запросов к API модели. Подождите или смените тариф или ключ.";
  }
  if (e.status === 400) {
    const m = e.message.toLowerCase();
    if (
      m.includes("provider returned") ||
      m.includes("response_format") ||
      m.includes("json_object") ||
      m.includes("json mode")
    ) {
      return "Провайдер API отклонил запрос (часто из‑за JSON mode или выбранной модели). В .env попробуйте OPENAI_DISABLE_JSON_MODE=true, другую OPENAI_MODEL или другой совместимый API.";
    }
  }
  return e.message || "Ошибка API модели";
}

/** Не даём исключениям из guards/Prisma уходить в ответ action — иначе в браузере часто «Failed to fetch». */
function toActionError(e: unknown): { error: string } {
  if (e instanceof APIError) {
    return { error: formatLlmApiError(e) };
  }
  if (e instanceof Error) {
    if (e.message === "UNAUTHORIZED") {
      return { error: "Сессия недоступна. Обновите страницу и войдите снова." };
    }
    if (e.message === "NOT_FOUND") {
      return { error: "Нет данных или нет доступа." };
    }
    const m = e.message;
    if (/timeout|ETIMEDOUT|aborted/i.test(m)) {
      return {
        error:
          "Таймаут ответа от API модели. Проверьте сеть, VPN, OPENAI_BASE_URL и при необходимости увеличьте OPENAI_TIMEOUT_MS в .env.",
      };
    }
    if (/fetch|ECONNRESET|ENOTFOUND|certificate/i.test(m)) {
      return {
        error:
          "Сеть не дошла до API (блокировка, VPN, неверный URL). Проверьте OPENAI_API_KEY и OPENAI_BASE_URL (например OpenRouter).",
      };
    }
    return { error: m };
  }
  return { error: "Внутренняя ошибка" };
}

export async function runGeneratePlanAI(vacancyId: string) {
  try {
    const userId = await requireUserId();
    const v = await prisma.vacancy.findFirst({
      where: { id: vacancyId, userId },
      include: {
        blocks: {
          orderBy: { sortOrder: "asc" },
          include: { questions: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!v) return { error: "Не найдено." };
    const roleProfile = mergedVacancyProfile(v.competencies, v.expectationsForCandidate);
    const ctx = {
      title: v.title,
      level: v.level,
      competencies: roleProfile,
      workFormat: v.workFormat ? (WORK_FORMAT_LABEL[v.workFormat] ?? v.workFormat) : undefined,
      targetCloseDateLabel: v.targetCloseDate
        ? new Date(v.targetCloseDate).toLocaleDateString("ru-RU")
        : undefined,
    };
    if (v.blocks.length === 0) {
      const plan = await generateInterviewPlan(ctx);
      const res = await replacePlanFromAI(vacancyId, plan);
      if ("error" in res) return res;
      return { ok: true as const };
    }
    const existingPlanJson = JSON.stringify(
      v.blocks.map((b) => ({
        title: b.title,
        required: b.required,
        questions: b.questions.map((q) => ({
          text: q.text,
          responseType: q.responseType === "rating" ? "rating" : "text",
        })),
      })),
    );
    const additions = await suggestInterviewPlanAdditions({
      ...ctx,
      existingPlanJson,
    });
    if (additions.blocks.length === 0) {
      return {
        ok: true as const,
        notice: "ИИ не предложил новых блоков — текущего плана может быть достаточно.",
      };
    }
    const res = await appendPlanFromAI(vacancyId, additions);
    if ("error" in res) return res;
    return {
      ok: true as const,
      notice: `Добавлено блоков: ${additions.blocks.length}.`,
    };
  } catch (e) {
    return toActionError(e);
  }
}

type ProtocolForText = {
  scores: {
    overallScore?: number | null;
    score: number;
    notes: string;
    planBlockId: string;
    planBlock?: { title: string } | null;
  }[];
  questionAnswers?: {
    textAnswer: string;
    scoreAnswer: number | null;
    planQuestion: { text: string; responseType: string; blockId: string };
  }[];
};

function buildProtocolsText(interviewers: { name: string; protocol: ProtocolForText | null }[]) {
  return interviewers
    .map((i) => {
      const p = i.protocol;
      if (!p || !(p.scores?.length ?? 0)) return `${i.name}:\n  (нет протокола)`;
      const qa = p.questionAnswers ?? [];
      const lines = (p.scores ?? []).map((s) => {
        const title = s.planBlock?.title ?? s.planBlockId;
        const subs = qa
          .filter((a) => a.planQuestion.blockId === s.planBlockId)
          .map((a) => {
            const rt = a.planQuestion.responseType === "rating" ? "rating" : "text";
            if (rt === "rating") {
              return `      · ${a.planQuestion.text}: ${a.scoreAnswer ?? "—"}/5`;
            }
            return `      · ${a.planQuestion.text}: ${a.textAnswer?.trim() || "—"}`;
          });
        const blockQa = qa.filter((a) => a.planQuestion.blockId === s.planBlockId);
        const hasRatings = blockQa.some((a) => a.planQuestion.responseType === "rating");
        const notesPart = s.notes?.trim() ? ` — ${s.notes.trim()}` : "";
        const overallPart = `общая оценка блока интервьюера: ${effectiveBlockOverall(s)}/5`;
        const rubricPart = hasRatings
          ? `среднее по балльным пунктам плана: ${s.score}/5`
          : null;
        const head = rubricPart
          ? `  [${title}] ${overallPart}; ${rubricPart}${notesPart}`
          : `  [${title}] ${overallPart}${notesPart}`;
        return subs.length ? `${head}\n${subs.join("\n")}` : head;
      });
      return `${i.name}:\n${lines.join("\n\n")}`;
    })
    .join("\n\n");
}

const protocolIncludeForAi = {
  scores: { include: { planBlock: true } },
  questionAnswers: {
    include: {
      planQuestion: { select: { text: true, responseType: true, blockId: true } },
    },
  },
} as const;

const candidateIncludeForSummaryAndDisc = {
  vacancy: {
    include: {
      blocks: { orderBy: { sortOrder: "asc" as const }, include: { questions: true } },
    },
  },
  interviewers: {
    include: {
      protocol: {
        include: protocolIncludeForAi,
      },
    },
  },
} as const;

async function buildDiscrepanciesJson(
  full: {
    interviewers: { name: string; protocol: ProtocolForText | null }[];
    vacancy: {
      blocks: { id: string; title: string; questions: { responseType: string }[] }[];
    };
  },
): Promise<string> {
  const filledProtocolsCount = full.interviewers.filter(
    (i) => (i.protocol?.scores?.length ?? 0) > 0,
  ).length;
  if (filledProtocolsCount < 2) {
    return JSON.stringify({
      discrepancies: [],
      narrative: null,
      discrepancyNotice:
        "Недостаточно данных для анализа расхождений: нужны заполненные протоколы минимум от двух интервьюеров. Когда появится второй протокол, снова нажмите «AI: сводка».",
    });
  }

  const blocks = full.vacancy.blocks.map((b) => ({
    id: b.id,
    title: b.title,
    hasRatingQuestions: blockHasRatingQuestions(b.questions),
  }));
  const protocols = full.interviewers
    .filter((i) => i.protocol)
    .map((i) => ({
      interviewerName: i.name,
      scores:
        (i.protocol?.scores ?? []).map((s) => ({
          planBlockId: s.planBlockId,
          overallScore: effectiveBlockOverall(s),
          rubricDerivedScore: s.score,
        })),
    }));
  const disc = computeDiscrepancies(blocks, protocols);
  const protocolsText = buildProtocolsText(full.interviewers);

  if (disc.length === 0) {
    return JSON.stringify({
      discrepancies: disc,
      narrative: null,
      discrepancyNotice: null,
    });
  }

  try {
    const narrative = await narrateDiscrepancies({
      discrepanciesJson: JSON.stringify(disc),
      protocolsText,
    });
    return JSON.stringify({
      discrepancies: disc,
      narrative,
      discrepancyNotice: null,
    });
  } catch {
    return JSON.stringify({
      discrepancies: disc,
      narrative: null,
      discrepancyNotice: null,
    });
  }
}

export async function runSummarizeAI(candidateId: string, vacancyId: string) {
  try {
    const userId = await requireUserId();
    const c = await assertCandidateOwner(candidateId, userId);
    if (c.vacancyId !== vacancyId) return { error: "Несовпадение вакансии." };

    const full = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: candidateIncludeForSummaryAndDisc,
    });
    if (!full) return { error: "Не найдено." };

    const protocolsText = buildProtocolsText(full.interviewers);
    const summary = await summarizeCandidate({
      candidateName: full.name.trim() || "Кандидат",
      vacancyTitle: full.vacancy.title,
      protocolsText,
    });
    const discrepanciesJson = await buildDiscrepanciesJson(full);
    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        summaryJson: JSON.stringify(summary),
        risksJson: JSON.stringify(summary.risks),
        summaryUpdatedAt: new Date(),
        discrepanciesJson,
      },
    });
    revalidatePath(`/vacancies/${vacancyId}/candidates/${candidateId}`);
    return { ok: true as const };
  } catch (e) {
    return toActionError(e);
  }
}

const MAX_COMPARE_BUNDLE_CHARS = 88_000;

export async function runCompareAllCandidatesAI(vacancyId: string) {
  try {
    const userId = await requireUserId();
    const v = await prisma.vacancy.findFirst({
      where: { id: vacancyId, userId },
      include: {
        blocks: { select: { id: true } },
        candidates: {
          include: {
            interviewers: {
              include: {
                protocol: {
                  include: protocolIncludeForAi,
                },
              },
            },
          },
        },
      },
    });
    if (!v) return { error: "Не найдено." };
    if (v.candidates.length < 2) {
      return { error: "Для сравнения нужно минимум два кандидата." };
    }

    const blockScoreRows = await prisma.blockScore.findMany({
      where: { planBlock: { vacancyId } },
      select: {
        score: true,
        protocol: { select: { interviewer: { select: { candidateId: true } } } },
      },
    });
    const { avgByCandidateId } = aggregateVacancyBlockOverallScores(blockScoreRows);

    const blockCount = v.blocks.length;
    const parts: string[] = [];
    for (const c of v.candidates) {
      const name = candidateDisplayName(c.name);
      const avg = avgByCandidateId[c.id] ?? candidateAvgScore(c);
      const readiness = candidateReadiness(c, blockCount);
      const protocolsText = buildProtocolsText(
        c.interviewers.map((i) => ({ name: i.name, protocol: i.protocol })),
      );
      parts.push(
        `--- Кандидат id=${c.id}\nОтображаемое имя: ${name}\nСредний балл (общие оценки блоков 1–5 по всем протоколам): ${avg ?? "—"}\nПротоколы: ${readiness.done}/${readiness.total} сдано\n\n${protocolsText}`,
      );
    }

    let candidatesBundle = parts.join("\n\n========\n\n");
    if (candidatesBundle.length > MAX_COMPARE_BUNDLE_CHARS) {
      candidatesBundle =
        candidatesBundle.slice(0, MAX_COMPARE_BUNDLE_CHARS) +
        "\n\n[…фрагмент усечён из‑за объёма; при необходимости сократите число заметок в протоколах…]";
    }

    const roleProfile = mergedVacancyProfile(v.competencies, v.expectationsForCandidate);
    const data = await compareAllCandidates({
      vacancyTitle: v.title,
      vacancyLevel: v.level,
      competenciesSummary: roleProfile.slice(0, 2500),
      candidatesBundle,
    });

    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}
