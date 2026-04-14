import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureBuiltInQuestionBank } from "../src/lib/ensure-question-bank";
import { blockHasRatingQuestions } from "../src/lib/block-scores";
import { computeDiscrepancies } from "../src/lib/discrepancies";

const prisma = new PrismaClient();

/** Целевое число кандидатов на демо-вакансию (в диапазоне 7–10). */
const TARGET_CANDIDATES_MAIN = 9;
const TARGET_CANDIDATES_EXTRA = 8;

type SummaryFromAI = {
  overallScore: number;
  strengths: string[];
  risks: string[];
  recommendation: "hire" | "reject" | "additional";
  evidenceNotes: string[];
};

async function seedSharedQuestionBank() {
  await ensureBuiltInQuestionBank(prisma);
  console.log("Общий банк вопросов (направления + универсальные блоки) проверен.");
}

const mainVacancyTitle = "Frontend-разработчик";

const DEMO_ANSWER_TEXT_VARIANTS = [
  "Кандидат ответил развёрнуто, привёл пример из недавнего проекта.",
  "Есть практический опыт; уточнили детали реализации и trade-offs.",
  "Ответ в целом удовлетворительный, по краевым случаям — поверхностно.",
  "Связно изложил ход рассуждений, зафиксировали риски и ограничения.",
  "Обсудили метрики и постановку задачи; логика последовательная.",
];

type BlockShapeForDemoAnswers = {
  sortOrder: number;
  questions: { id: string; responseType: string }[];
};

function demoQuestionAnswerCreates(blocks: BlockShapeForDemoAnswers[], salt: string) {
  return blocks.flatMap((block) =>
    block.questions.map((q, qi) => {
      if (q.responseType === "rating") {
        const n = 3 + ((salt.length + qi + block.sortOrder * 11) % 3);
        return { planQuestionId: q.id, textAnswer: "", scoreAnswer: n };
      }
      const idx =
        (salt.charCodeAt(0) + qi * 13 + block.sortOrder * 7) % DEMO_ANSWER_TEXT_VARIANTS.length;
      return {
        planQuestionId: q.id,
        textAnswer: DEMO_ANSWER_TEXT_VARIANTS[idx]!,
        scoreAnswer: null as number | null,
      };
    }),
  );
}

function defaultNotesForBlock(idx: number): string {
  if (idx === 0) return "Сильная база по блоку; обсудили детали и примеры.";
  if (idx === 1) return "Архитектурные решения и глубина — средние, часть тем поверхностно.";
  return "Коммуникация и софт-скиллы: уверенно или с оговорками — см. ответы.";
}

function buildStoredDiscrepanciesJson(
  interviewers: Array<{
    name: string;
    protocol: { scores: { planBlockId: string; overallScore: number; score: number }[] } | null;
  }>,
  blocks: Array<{ id: string; title: string; questions: { responseType: string }[] }>,
): string {
  const filledProtocolsCount = interviewers.filter((i) => (i.protocol?.scores?.length ?? 0) > 0).length;
  if (filledProtocolsCount < 2) {
    return JSON.stringify({
      discrepancies: [],
      narrative: null,
      discrepancyNotice:
        "Для анализа расхождений нужны заполненные протоколы минимум от двух интервьюеров. Сейчас готово меньше двух.",
    });
  }
  const blocksMeta = blocks.map((b) => ({
    id: b.id,
    title: b.title,
    hasRatingQuestions: blockHasRatingQuestions(b.questions),
  }));
  const protocols = interviewers
    .filter((i) => i.protocol && (i.protocol.scores?.length ?? 0) > 0)
    .map((i) => ({
      interviewerName: i.name,
      scores: (i.protocol?.scores ?? []).map((s) => ({
        planBlockId: s.planBlockId,
        overallScore: s.overallScore,
        rubricDerivedScore: s.score,
      })),
    }));
  const disc = computeDiscrepancies(blocksMeta, protocols);
  return JSON.stringify({
    discrepancies: disc,
    narrative: null,
    discrepancyNotice: null,
  });
}

async function loadVacancyBlocksShape(vacancyId: string): Promise<{
  blocks: { id: string; sortOrder: number }[];
  blockShapeForAnswers: BlockShapeForDemoAnswers[];
}> {
  const blocksWithQuestions = await prisma.planBlock.findMany({
    where: { vacancyId },
    orderBy: { sortOrder: "asc" },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  const blocks = blocksWithQuestions.map((b) => ({ id: b.id, sortOrder: b.sortOrder }));
  const blockShapeForAnswers: BlockShapeForDemoAnswers[] = blocksWithQuestions.map((b) => ({
    sortOrder: b.sortOrder,
    questions: b.questions.map((q) => ({ id: q.id, responseType: q.responseType })),
  }));
  return { blocks, blockShapeForAnswers };
}

async function createSubmittedProtocol(
  interviewerId: string,
  blocks: { id: string }[],
  blockShapeForAnswers: BlockShapeForDemoAnswers[],
  overallByBlock: number[],
  rubricByBlock: number[],
  salt: string,
) {
  await prisma.protocol.create({
    data: {
      interviewerId,
      submittedAt: new Date(),
      scores: {
        create: blocks.map((b, idx) => ({
          planBlockId: b.id,
          overallScore: overallByBlock[idx] ?? 3,
          score: rubricByBlock[idx] ?? 3,
          notes: defaultNotesForBlock(idx),
        })),
      },
      questionAnswers: {
        create: demoQuestionAnswerCreates(blockShapeForAnswers, salt),
      },
    },
  });
}

async function applyDemoSummaryAndDisc(
  candidateId: string,
  summary: SummaryFromAI | null,
  setSummary: boolean,
) {
  const full = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      interviewers: { include: { protocol: { include: { scores: true } } } },
      vacancy: {
        include: {
          blocks: { orderBy: { sortOrder: "asc" }, include: { questions: true } },
        },
      },
    },
  });
  if (!full) return;
  const discJson = buildStoredDiscrepanciesJson(full.interviewers, full.vacancy.blocks);
  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      discrepanciesJson: discJson,
      ...(setSummary && summary
        ? {
            summaryJson: JSON.stringify(summary),
            risksJson: JSON.stringify(summary.risks),
            summaryUpdatedAt: new Date(),
          }
        : {}),
    },
  });
}

type MainDemoSpec = {
  name: string;
  interviewers: { name: string; token: string }[];
  /** null = протокол не создан (слот пустой) */
  matrix: (number[] | null)[];
  summary: SummaryFromAI | null;
  setSummary: boolean;
};

function mainFrontendDemoSpecs(): MainDemoSpec[] {
  const s = (partial: Partial<SummaryFromAI> & Pick<SummaryFromAI, "recommendation">): SummaryFromAI => ({
    overallScore: partial.overallScore ?? 3,
    strengths: partial.strengths ?? ["Сильные стороны (демо-сводка)."],
    risks: partial.risks ?? ["Риски (демо-сводка)."],
    recommendation: partial.recommendation,
    evidenceNotes: partial.evidenceNotes ?? [],
  });

  return [
    {
      name: "Алексей Иванов",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-oleg" },
        { name: "Ирина (HR BP)", token: "invite-demo-irina" },
      ],
      matrix: [
        [5, 4, 4],
        [2, 3, 3],
        [4, 4, 5],
      ],
      summary: null,
      setSummary: false,
    },
    {
      name: "Елена Смирнова",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo2-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo2-oleg" },
      ],
      matrix: [
        [4, 4, 4],
        [4, 4, 4],
      ],
      summary: s({ overallScore: 4, recommendation: "hire", strengths: ["Стабильный middle+, хорошая коммуникация."] }),
      setSummary: true,
    },
    {
      name: "Борис Панов",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-boris-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-boris-oleg" },
      ],
      matrix: [
        [5, 5, 5],
        [2, 2, 2],
      ],
      summary: s({
        overallScore: 3,
        recommendation: "additional",
        risks: ["Сильный разброс мнений интервьюеров по всем блокам."],
      }),
      setSummary: true,
    },
    {
      name: "Виктор Рыбак",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-victor-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-victor-oleg" },
      ],
      matrix: [[4, 4, 4], null],
      summary: s({
        overallScore: 3,
        recommendation: "additional",
        strengths: ["По одному протоколу картина неплохая; нужен второй интервьюер."],
      }),
      setSummary: true,
    },
    {
      name: "Галина Соколова",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-galina-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-galina-oleg" },
      ],
      matrix: [
        [5, 5, 4],
        [5, 4, 5],
      ],
      summary: s({ overallScore: 5, recommendation: "hire", strengths: ["Выравненно высокие оценки, консенсус."] }),
      setSummary: true,
    },
    {
      name: "Денис Орлов",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-denis-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-denis-oleg" },
      ],
      matrix: [
        [4, 2, 4],
        [5, 5, 5],
      ],
      summary: s({
        overallScore: 2,
        recommendation: "reject",
        risks: ["Расхождение по системному блоку и общий негатив одного из интервьюеров."],
      }),
      setSummary: true,
    },
    {
      name: "Жанна Ким",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-zhanna-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-zhanna-oleg" },
      ],
      matrix: [
        [2, 2, 3],
        [3, 2, 3],
      ],
      summary: s({
        overallScore: 2,
        recommendation: "reject",
        risks: ["Нижний коридор оценок без явных расхождений >2 — консенсус «слабо»."],
      }),
      setSummary: true,
    },
    {
      name: "Захар Мельников",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-zakhar-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-zakhar-oleg" },
        { name: "Ирина (HR BP)", token: "invite-demo-zakhar-irina" },
      ],
      matrix: [
        [5, 5, 5],
        [2, 2, 2],
        null,
      ],
      summary: s({
        overallScore: 3,
        recommendation: "additional",
        risks: ["Два противоположных мнения; третий интервьюер ещё не закрыл протокол."],
      }),
      setSummary: true,
    },
    {
      name: "Ирина Тихонова",
      interviewers: [
        { name: "Мария (Tech Lead)", token: "invite-demo-irina2-maria" },
        { name: "Олег (Engineering Manager)", token: "invite-demo-irina2-oleg" },
      ],
      matrix: [
        [3, 3, 3],
        [4, 4, 4],
      ],
      summary: null,
      setSummary: false,
    },
  ];
}

async function syncMainVacancyDemoCandidates(vacancyId: string) {
  const { blocks, blockShapeForAnswers } = await loadVacancyBlocksShape(vacancyId);
  const nBlocks = blocks.length;
  const specs = mainFrontendDemoSpecs();

  for (const spec of specs) {
    let candidate = await prisma.candidate.findFirst({
      where: { vacancyId, name: spec.name },
      include: { interviewers: { include: { protocol: true } } },
    });

    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          vacancyId,
          name: spec.name,
          interviewers: {
            create: spec.interviewers.map((inv) => ({
              name: inv.name,
              inviteToken: inv.token,
            })),
          },
        },
        include: { interviewers: { include: { protocol: true } } },
      });
    }

    const ivs = await prisma.interviewer.findMany({
      where: { candidateId: candidate.id },
    });

    for (let i = 0; i < spec.interviewers.length; i++) {
      const meta = spec.interviewers[i]!;
      const inv = ivs.find((x) => x.inviteToken === meta.token);
      if (!inv) continue;
      const row = spec.matrix[i];
      const existing = await prisma.protocol.findUnique({ where: { interviewerId: inv.id } });
      if (existing) continue;
      if (row == null) continue;
      const overall = row.slice(0, nBlocks);
      while (overall.length < nBlocks) overall.push(3);
      const rubric = overall.map(() => 3);
      await createSubmittedProtocol(inv.id, blocks, blockShapeForAnswers, overall, rubric, inv.inviteToken);
    }

    await applyDemoSummaryAndDisc(candidate.id, spec.summary, spec.setSummary);
  }

  const total = await prisma.candidate.count({ where: { vacancyId } });
  console.log(`Основная вакансия «${mainVacancyTitle}»: кандидатов в базе — ${total} (цель ${TARGET_CANDIDATES_MAIN}).`);
}

type ExtraQuestion = { text: string; sortOrder: number; responseType?: string };

type ExtraVacancySpec = {
  title: string;
  level: string;
  competencies: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "draft" | "active" | "on_hold" | "closed";
  workFormat: "office" | "hybrid" | "remote" | "";
  slug: string;
  blocks: {
    title: string;
    sortOrder: number;
    required: boolean;
    questions: ExtraQuestion[];
  }[];
};

const extraVacancies: ExtraVacancySpec[] = [
  {
    title: "Backend-разработчик (Node.js)",
    slug: "be",
    level: "Middle+",
    competencies:
      "Node.js, PostgreSQL, микросервисы, очереди, проектирование API, observability",
    priority: "high",
    status: "active",
    workFormat: "hybrid",
    blocks: [
      {
        title: "Технический стек",
        sortOrder: 0,
        required: true,
        questions: [
          { text: "Как проектировали отказоустойчивый API под нагрузкой?", sortOrder: 0 },
          { text: "Опыт с транзакциями и изоляцией в PostgreSQL.", sortOrder: 1 },
          { text: "Самооценка глубины по стеку (1–5).", sortOrder: 2, responseType: "rating" },
        ],
      },
      {
        title: "Системный дизайн",
        sortOrder: 1,
        required: true,
        questions: [
          { text: "Пример декомпозиции монолита или границ сервисов.", sortOrder: 0 },
          { text: "Оценка зрелости системного мышления (1–5).", sortOrder: 1, responseType: "rating" },
        ],
      },
    ],
  },
  {
    title: "Product Manager",
    slug: "pm",
    level: "Middle",
    competencies:
      "Discovery, метрики, приоритизация, работа со стейкхолдерами, roadmap, A/B",
    priority: "normal",
    status: "active",
    workFormat: "remote",
    blocks: [
      {
        title: "Продуктовое мышление",
        sortOrder: 0,
        required: true,
        questions: [
          { text: "Как выбирали что не делать в квартале?", sortOrder: 0 },
          { text: "Пример гипотезы и как проверяли.", sortOrder: 1 },
          { text: "Балл за культуру экспериментов (1–5).", sortOrder: 2, responseType: "rating" },
        ],
      },
      {
        title: "Коммуникация",
        sortOrder: 1,
        required: false,
        questions: [{ text: "Конфликт приоритетов с инженерией — кейс.", sortOrder: 0 }],
      },
    ],
  },
  {
    title: "UX/UI дизайнер",
    slug: "ux",
    level: "Middle",
    competencies: "Figma, дизайн-системы, исследования, доступность, handoff в разработку",
    priority: "normal",
    status: "on_hold",
    workFormat: "office",
    blocks: [
      {
        title: "Процесс и инструменты",
        sortOrder: 0,
        required: true,
        questions: [
          { text: "Как вели дизайн-систему в связке с фронтом?", sortOrder: 0 },
          { text: "Навыки Figma и компонентов (1–5).", sortOrder: 1, responseType: "rating" },
        ],
      },
      {
        title: "Исследования",
        sortOrder: 1,
        required: true,
        questions: [{ text: "Пример UX-проблемы, найденной через интервью.", sortOrder: 0 }],
      },
    ],
  },
  {
    title: "Data Analyst",
    slug: "da",
    level: "Junior+",
    competencies: "SQL, визуализация, статистика, эксперименты, dbt/BI — плюс",
    priority: "low",
    status: "active",
    workFormat: "hybrid",
    blocks: [
      {
        title: "Аналитика и SQL",
        sortOrder: 0,
        required: true,
        questions: [
          { text: "Сложный SQL-запрос или оптимизация, с которыми сталкивались.", sortOrder: 0 },
          { text: "Уверенность в SQL (1–5).", sortOrder: 1, responseType: "rating" },
        ],
      },
      {
        title: "Бизнес-контекст",
        sortOrder: 1,
        required: true,
        questions: [{ text: "Как объясняли метрику нетехнической аудитории?", sortOrder: 0 }],
      },
    ],
  },
  {
    title: "DevOps / SRE",
    slug: "sre",
    level: "Senior",
    competencies: "Kubernetes, CI/CD, мониторинг, IaC, инцидент-менеджмент, безопасность",
    priority: "urgent",
    status: "active",
    workFormat: "remote",
    blocks: [
      {
        title: "Инфраструктура",
        sortOrder: 0,
        required: true,
        questions: [
          { text: "Как настраивали алерты и SLO для критичного сервиса?", sortOrder: 0 },
          { text: "Опыт с GitOps или IaC.", sortOrder: 1 },
          { text: "Уровень по K8s (1–5).", sortOrder: 2, responseType: "rating" },
        ],
      },
      {
        title: "Инциденты",
        sortOrder: 1,
        required: true,
        questions: [{ text: "Разбор постмортема: что улучшили в процессе?", sortOrder: 0 }],
      },
    ],
  },
];

const EXTRA_FIRST_NAMES = [
  "Антон",
  "Светлана",
  "Михаил",
  "Полина",
  "Георгий",
  "Алина",
  "Тимофей",
  "Вероника",
  "Степан",
  "Карина",
];

/** Шаблоны оценок по блокам для 2 интервьюеров; часть сценариев с расхождениями >2. */
function extraCandidateMatrixPattern(
  index: number,
  nBlocks: number,
): { a: number[]; b: (number[] | null); summary: SummaryFromAI | null; setSummary: boolean } {
  const pad = (arr: number[]) => {
    const o = [...arr];
    while (o.length < nBlocks) o.push(3);
    return o.slice(0, nBlocks);
  };
  const patterns: Array<{
    a: number[];
    b: number[] | null;
    summary: SummaryFromAI | null;
    setSummary: boolean;
  }> = [
    { a: [5, 4], b: [2, 2], summary: { overallScore: 3, strengths: [], risks: ["Разброс мнений."], recommendation: "additional", evidenceNotes: [] }, setSummary: true },
    { a: [4, 4], b: [4, 3], summary: { overallScore: 4, strengths: ["Ровный профиль."], risks: [], recommendation: "hire", evidenceNotes: [] }, setSummary: true },
    { a: [5, 5], b: [1, 2], summary: { overallScore: 2, strengths: [], risks: ["Жёсткое расхождение."], recommendation: "reject", evidenceNotes: [] }, setSummary: true },
    { a: [4, 4], b: null, summary: { overallScore: 3, strengths: ["Один протокол."], risks: ["Нужен второй интервьюер."], recommendation: "additional", evidenceNotes: [] }, setSummary: true },
    { a: [3, 3], b: [3, 4], summary: null, setSummary: false },
    { a: [5, 3], b: [4, 4], summary: { overallScore: 4, strengths: [], risks: [], recommendation: "hire", evidenceNotes: [] }, setSummary: true },
    { a: [2, 3], b: [5, 4], summary: { overallScore: 3, strengths: [], risks: [], recommendation: "additional", evidenceNotes: [] }, setSummary: true },
    { a: [4, 2], b: [4, 5], summary: { overallScore: 3, strengths: [], risks: [], recommendation: "additional", evidenceNotes: [] }, setSummary: true },
  ];
  const p = patterns[index % patterns.length]!;
  return { a: pad(p.a), b: p.b ? pad(p.b) : null, summary: p.summary, setSummary: p.setSummary };
}

async function seedExtraVacancyCandidates(
  vacancyId: string,
  slug: string,
  startIndex: number,
  count: number,
) {
  const { blocks, blockShapeForAnswers } = await loadVacancyBlocksShape(vacancyId);
  const nBlocks = blocks.length;

  for (let k = 0; k < count; k++) {
    const index = startIndex + k;
    const name = `${EXTRA_FIRST_NAMES[index % EXTRA_FIRST_NAMES.length]} ${["Волков", "Новикова", "Орлова", "Козлов", "Лебедев"][index % 5]} (${slug.toUpperCase()} ${index + 1})`;
    const exists = await prisma.candidate.findFirst({ where: { vacancyId, name } });
    if (exists) continue;

    const tokenA = `invite-extra-${slug}-${index}-a`;
    const tokenB = `invite-extra-${slug}-${index}-b`;
    const { a, b, summary, setSummary } = extraCandidateMatrixPattern(index, nBlocks);

    const candidate = await prisma.candidate.create({
      data: {
        vacancyId,
        name,
        interviewers: {
          create: [
            { name: "Интервьюер A", inviteToken: tokenA },
            { name: "Интервьюер B", inviteToken: tokenB },
          ],
        },
      },
      include: { interviewers: true },
    });

    const ivA = candidate.interviewers.find((i) => i.inviteToken === tokenA)!;
    const ivB = candidate.interviewers.find((i) => i.inviteToken === tokenB)!;

    await createSubmittedProtocol(ivA.id, blocks, blockShapeForAnswers, a, a.map(() => 3), tokenA);
    if (b) {
      await createSubmittedProtocol(ivB.id, blocks, blockShapeForAnswers, b, b.map(() => 3), tokenB);
    }

    await applyDemoSummaryAndDisc(candidate.id, summary, setSummary);
  }
}

async function ensureExtraVacancy(spec: ExtraVacancySpec, userId: string) {
  let v = await prisma.vacancy.findFirst({
    where: { userId, title: spec.title },
    include: { candidates: true },
  });

  if (!v) {
    v = await prisma.vacancy.create({
      data: {
        userId,
        title: spec.title,
        level: spec.level,
        competencies: spec.competencies,
        priority: spec.priority,
        status: spec.status,
        workFormat: spec.workFormat,
        blocks: {
          create: spec.blocks.map((b) => ({
            title: b.title,
            sortOrder: b.sortOrder,
            required: b.required,
            questions: {
              create: b.questions.map((q) => ({
                text: q.text,
                sortOrder: q.sortOrder,
                ...(q.responseType ? { responseType: q.responseType } : {}),
              })),
            },
          })),
        },
      },
      include: { candidates: true },
    });
    console.log(`Добавлена вакансия: ${spec.title}`);
  }

  const need = Math.max(0, TARGET_CANDIDATES_EXTRA - v.candidates.length);
  if (need > 0) {
    await seedExtraVacancyCandidates(v.id, spec.slug, v.candidates.length, need);
    console.log(`  → дозаполнено кандидатов: ${need} (вакансия «${spec.title}»).`);
  } else {
    console.log(`Вакансия уже с достаточным числом кандидатов: ${spec.title}`);
  }
}

/** Протоколы, созданные старым сидом только с BlockScore, без строк QuestionAnswer. */
async function backfillEmptyProtocolQuestionAnswers() {
  const protocols = await prisma.protocol.findMany({
    where: {
      submittedAt: { not: null },
      questionAnswers: { none: {} },
    },
    include: {
      interviewer: {
        include: {
          candidate: {
            include: {
              vacancy: {
                include: {
                  blocks: {
                    orderBy: { sortOrder: "asc" },
                    include: { questions: { orderBy: { sortOrder: "asc" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let filled = 0;
  for (const p of protocols) {
    const blocks = p.interviewer.candidate.vacancy.blocks;
    const shape: BlockShapeForDemoAnswers[] = blocks.map((b) => ({
      sortOrder: b.sortOrder,
      questions: b.questions.map((q) => ({ id: q.id, responseType: q.responseType })),
    }));
    const rows = demoQuestionAnswerCreates(shape, p.interviewer.inviteToken);
    if (rows.length === 0) continue;
    await prisma.questionAnswer.createMany({
      data: rows.map((row) => ({
        protocolId: p.id,
        planQuestionId: row.planQuestionId,
        textAnswer: row.textAnswer,
        scoreAnswer: row.scoreAnswer,
      })),
    });
    filled += 1;
  }

  if (filled > 0) {
    console.log(`Дозаполнены ответы по вопросам в протоколах (без повторного создания вакансий): ${filled}.`);
  }
}

async function main() {
  await seedSharedQuestionBank();

  const passwordHash = await bcrypt.hash("demo123", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@demo.com" },
    update: {},
    create: {
      email: "demo@demo.com",
      passwordHash,
      name: "Демо HR",
    },
  });

  let mainVacancy = await prisma.vacancy.findFirst({
    where: { userId: user.id, title: mainVacancyTitle },
  });

  if (!mainVacancy) {
    mainVacancy = await prisma.vacancy.create({
      data: {
        userId: user.id,
        title: mainVacancyTitle,
        level: "Middle+",
        competencies: "React, TypeScript, архитектура UI, коммуникация",
        blocks: {
          create: [
            {
              title: "Технические навыки",
              sortOrder: 0,
              required: true,
              questions: {
                create: [
                  { text: "Опишите опыт с React Server Components.", sortOrder: 0 },
                  { text: "Как вы подходите к типизации крупного модуля?", sortOrder: 1 },
                  {
                    text: "Самооценка сильных сторон по стеку (1–5).",
                    sortOrder: 2,
                    responseType: "rating",
                  },
                ],
              },
            },
            {
              title: "Системное мышление",
              sortOrder: 1,
              required: true,
              questions: {
                create: [
                  {
                    text: "Пример рефакторинга легаси без остановки релизов.",
                    sortOrder: 0,
                  },
                  { text: "Оценка зрелости архитектурных решений (1–5).", sortOrder: 1, responseType: "rating" },
                ],
              },
            },
            {
              title: "Софт-скиллы",
              sortOrder: 2,
              required: false,
              questions: {
                create: [{ text: "Конфликт в команде: как действовали?", sortOrder: 0 }],
              },
            },
          ],
        },
      },
    });
    console.log("Создана основная демо-вакансия Frontend (план).");
  } else {
    console.log("Основная демо-вакансия уже есть — синхронизируем кандидатов.");
  }

  await syncMainVacancyDemoCandidates(mainVacancy.id);

  for (const spec of extraVacancies) {
    await ensureExtraVacancy(spec, user.id);
  }

  await backfillEmptyProtocolQuestionAnswers();

  const count = await prisma.vacancy.count({ where: { userId: user.id } });
  console.log(`Seed OK. Вакансий у demo@demo.com: ${count}. Логин: demo@demo.com / demo123`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
