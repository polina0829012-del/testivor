import { notFound } from "next/navigation";
import { getInterviewContext } from "@/actions/protocol";
import { effectiveBlockOverall } from "@/lib/block-scores";
import { parseQuestionResponseType } from "@/lib/plan-question-types";
import { mergedVacancyProfile } from "@/lib/vacancy-profile";
import { ProtocolForm } from "./protocol-form";

/** Публичная ссылка: всегда свежие данные из БД, без статического кэша. */
export const dynamic = "force-dynamic";

export default async function InterviewPublicPage({
  params,
}: {
  params: { token: string };
}) {
  const ctx = await getInterviewContext(params.token);
  if (!ctx) notFound();

  const { candidate, protocol } = ctx;
  const vacancy = candidate.vacancy;
  const blocks = vacancy.blocks;

  const existingByBlockId: Record<string, { notes: string; overallScore: number } | undefined> = {};
  for (const s of protocol?.scores ?? []) {
    existingByBlockId[s.planBlockId] = { notes: s.notes, overallScore: effectiveBlockOverall(s) };
  }

  const existingByQuestionId: Record<string, { textAnswer: string; scoreAnswer: number | null } | undefined> = {};
  for (const a of protocol?.questionAnswers ?? []) {
    existingByQuestionId[a.planQuestionId] = {
      textAnswer: a.textAnswer,
      scoreAnswer: a.scoreAnswer,
    };
  }

  const blocksPayload = blocks.map((b) => ({
    id: b.id,
    title: b.title,
    required: b.required,
    questions: b.questions.map((q) => ({
      id: q.id,
      text: q.text,
      responseType: parseQuestionResponseType(q.responseType),
    })),
  }));

  const vacancyProfileForInterviewer = mergedVacancyProfile(
    vacancy.competencies,
    vacancy.expectationsForCandidate,
  ).trim();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[min(100%,1440px)] flex-col px-[max(0.75rem,env(safe-area-inset-left))] py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-6 sm:py-6 lg:px-8">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Протокол интервью</h1>
      <p className="mt-1.5 text-sm leading-snug text-[hsl(var(--muted))]">
        Вакансия: <strong className="text-[hsl(var(--foreground))]">{vacancy.title}</strong>
        {candidate.name.trim() ? (
          <>
            {" "}
            · Кандидат: <strong className="text-[hsl(var(--foreground))]">{candidate.name}</strong>
          </>
        ) : (
          <>
            {" "}
            · ФИО укажите в форме рядом с описанием роли
          </>
        )}
      </p>
      <p className="mt-0.5 text-sm text-[hsl(var(--muted))]">Интервьюер: {ctx.name}</p>

      <div className="flex min-h-0 flex-1 flex-col">
        <ProtocolForm
          token={params.token}
          blocks={blocksPayload}
          existingByBlockId={existingByBlockId}
          existingByQuestionId={existingByQuestionId}
          initialCandidateName={candidate.name}
          vacancyProfileText={vacancyProfileForInterviewer}
        />
      </div>
    </div>
  );
}
