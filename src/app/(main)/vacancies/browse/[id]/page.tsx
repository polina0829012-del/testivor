import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mergedVacancyProfile } from "@/lib/vacancy-profile";
import { PRIORITY_LABEL, STATUS_LABEL, WORK_FORMAT_LABEL } from "@/lib/vacancy-labels";
import { parseQuestionResponseType, questionResponseTypeLabel } from "@/lib/plan-question-types";

export default async function BrowseVacancyReadOnlyPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const v = await prisma.vacancy.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { email: true, name: true } },
      blocks: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } },
      _count: { select: { candidates: true } },
    },
  });
  if (!v) notFound();

  const mine = v.userId === session.user.id;
  if (mine) {
    redirect(`/vacancies/${v.id}`);
  }

  const owner = v.user.name?.trim() || v.user.email;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/vacancies/browse" className="text-sm text-[hsl(var(--muted))] hover:underline">
          ← Все вакансии
        </Link>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Просмотр · не ваши данные кандидатов
        </p>
        <h1 className="mt-1 text-2xl font-bold">{v.title}</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted))]">
          Владелец: <strong>{owner}</strong>
          <br />
          Уровень: {v.level}
          {v.workFormat ? ` · ${WORK_FORMAT_LABEL[v.workFormat] ?? v.workFormat}` : ""}
          {v.targetCloseDate ? ` · закрыть до ${new Date(v.targetCloseDate).toLocaleDateString("ru-RU")}` : ""}
          <br />
          Приоритет: {PRIORITY_LABEL[v.priority] ?? v.priority} · Статус: {STATUS_LABEL[v.status] ?? v.status}
          <br />
          Кандидатов в работе: {v._count.candidates} (список доступен только владельцу)
        </p>
      </div>

      <section className="rounded-xl border border-black/10 bg-[hsl(var(--surface))] p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Компетенции и пожелания к кандидату</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {mergedVacancyProfile(v.competencies, v.expectationsForCandidate) || "—"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">План интервью</h2>
        <p className="text-sm text-[hsl(var(--muted))]">Только чтение. Редактирование доступно владельцу вакансии.</p>
        <div className="space-y-3">
          {v.blocks.map((block) => (
            <div key={block.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="font-semibold">{block.title}</h3>
                {block.required ? (
                  <span className="text-xs text-amber-700 dark:text-amber-300">Обязательный блок</span>
                ) : null}
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                {block.questions.map((q) => {
                  const rt = parseQuestionResponseType(q.responseType);
                  return (
                    <li key={q.id} className="leading-snug">
                      <span>{q.text}</span>
                      <span className="ml-2 text-xs text-[hsl(var(--muted))]">({questionResponseTypeLabel(rt)})</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
