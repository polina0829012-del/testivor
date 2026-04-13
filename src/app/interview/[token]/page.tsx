import { notFound } from "next/navigation";
import { getInterviewContext } from "@/actions/protocol";
import { parseQuestionResponseType } from "@/lib/plan-question-types";
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

  const existingByBlockId: Record<string, { notes: string } | undefined> = {};
  for (const s of protocol?.scores ?? []) {
    existingByBlockId[s.planBlockId] = { notes: s.notes };
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[min(100%,1440px)] flex-col px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
      <h1 className="text-2xl font-bold">Протокол интервью</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted))]">
        Вакансия: <strong>{vacancy.title}</strong>
        {candidate.name.trim() ? (
          <>
            {" "}
            · Кандидат: <strong>{candidate.name}</strong>
          </>
        ) : (
          <>
            {" "}
            · ФИО кандидата укажите в форме ниже — оно сохранится для HR
          </>
        )}
      </p>
      <p className="mt-1 text-sm text-[hsl(var(--muted))]">Интервьюер: {ctx.name}</p>

      <div className="flex min-h-0 flex-1 flex-col">
      <ProtocolForm
        token={params.token}
        blocks={blocksPayload}
        existingByBlockId={existingByBlockId}
        existingByQuestionId={existingByQuestionId}
        initialCandidateName={candidate.name}
      />
      </div>
    </div>
  );
}
