import OpenAI from "openai";

function client() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY не задан");
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const defaultHeaders: Record<string, string> = {};
  if (baseURL?.includes("openrouter.ai")) {
    const referer = process.env.OPENROUTER_HTTP_REFERER || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const title = process.env.OPENROUTER_APP_TITLE || "Interview Intelligence Platform";
    defaultHeaders["HTTP-Referer"] = referer;
    defaultHeaders["X-Title"] = title;
  }
  return new OpenAI({
    apiKey: key,
    baseURL,
    defaultHeaders: Object.keys(defaultHeaders).length ? defaultHeaders : undefined,
    timeout: Number(process.env.OPENAI_TIMEOUT_MS) || 120_000,
    maxRetries: 1,
  });
}

function vacancyExtraContext(params: { workFormat?: string; targetCloseDateLabel?: string }) {
  return [
    params.workFormat?.trim() ? `Формат работы: ${params.workFormat.trim()}` : "",
    params.targetCloseDateLabel?.trim()
      ? `Желательный срок закрытия: ${params.targetCloseDateLabel.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export type PlanFromAI = {
  blocks: {
    title: string;
    required: boolean;
    questions: { text: string; responseType?: string }[];
  }[];
};

export type SummaryFromAI = {
  overallScore: number;
  strengths: string[];
  risks: string[];
  recommendation: "hire" | "reject" | "additional";
  evidenceNotes: string[];
};

export async function generateInterviewPlan(params: {
  title: string;
  level: string;
  /** Компетенции, контекст роли и пожелания к кандидату — единым текстом. */
  competencies: string;
  workFormat?: string;
  targetCloseDateLabel?: string;
}): Promise<PlanFromAI> {
  const extra = vacancyExtraContext(params);

  const openai = client();
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Ты HR-эксперт. Верни только JSON: { "blocks": [ { "title": string, "required": boolean, "questions": [ { "text": string, "responseType"?: "text" | "rating" } ] } ] }. У каждого вопроса по желанию responseType: "text" (развёрнутый ответ) или "rating" (балл 1–5 по пункту); по умолчанию считай text. 3–6 блоков, 2–4 вопроса в каждом, на русском.',
      },
      {
        role: "user",
        content: `Вакансия: ${params.title}. Уровень: ${params.level}. Описание роли (компетенции, задачи, пожелания к кандидату, контекст):\n${params.competencies}${extra ? `\n\n${extra}` : ""}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Пустой ответ модели");
  const parsed = JSON.parse(raw) as PlanFromAI;
  if (!parsed.blocks?.length) throw new Error("Некорректная структура плана");
  return parsed;
}

/** Дополнения к уже существующему плану (без дублирования тем); может вернуть пустой blocks. */
export async function suggestInterviewPlanAdditions(params: {
  title: string;
  level: string;
  competencies: string;
  workFormat?: string;
  targetCloseDateLabel?: string;
  existingPlanJson: string;
}): Promise<PlanFromAI> {
  const extra = vacancyExtraContext(params);
  const openai = client();
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Ты HR. У пользователя уже есть план интервью (JSON в сообщении). Предложи ТОЛЬКО НОВЫЕ блоки и вопросы. Верни JSON: { "blocks": [ { "title": string, "required": boolean, "questions": [ { "text": string, "responseType"?: "text" | "rating" } ] } ] }. От 0 до 4 блоков, 1–3 вопроса в каждом. Если плана достаточно, верни { "blocks": [] }.',
      },
      {
        role: "user",
        content: `Вакансия: ${params.title}. Уровень: ${params.level}. Описание роли (компетенции, задачи, пожелания к кандидату, контекст):\n${params.competencies}${extra ? `\n\n${extra}` : ""}\n\nТекущий план (JSON массив блоков с вопросами):\n${params.existingPlanJson}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Пустой ответ модели");
  const parsed = JSON.parse(raw) as PlanFromAI;
  if (!Array.isArray(parsed.blocks)) throw new Error("Некорректная структура ответа");
  const blocks = parsed.blocks
    .map((b) => ({
      title: String(b.title ?? "").trim() || "Дополнение к плану",
      required: Boolean(b.required),
      questions: (b.questions ?? [])
        .map((q) => {
          const text = String((q as { text?: string }).text ?? "").trim();
          const rt = (q as { responseType?: string }).responseType;
          return {
            text,
            responseType: rt === "rating" ? ("rating" as const) : ("text" as const),
          };
        })
        .filter((q) => q.text.length > 0),
    }))
    .filter((b) => b.questions.length > 0);
  return { blocks };
}

export async function summarizeCandidate(params: {
  candidateName: string;
  vacancyTitle: string;
  protocolsText: string;
}): Promise<SummaryFromAI> {
  const openai = client();
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Ты аналитик интервью. Верни только JSON:
{
  "overallScore": number (1–5, общее впечатление),
  "strengths": string[] (сильные стороны по-русски),
  "risks": string[] (риски по-русски),
  "recommendation": ровно одна строка из трёх латинских кодов:
    "hire" — рекомендуешь приглашение/найм;
    "reject" — не рекомендуешь, кандидат не подходит;
    "additional" — нужны ещё интервью или уточнение перед решением.
  "evidenceNotes": string[] (короткие опоры из протоколов, до 5, по-русски)
}
Только JSON, без комментариев.`,
      },
      {
        role: "user",
        content: `Кандидат: ${params.candidateName}. Вакансия: ${params.vacancyTitle}.\n\nПротоколы и заметки:\n${params.protocolsText}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Пустой ответ модели");
  return JSON.parse(raw) as SummaryFromAI;
}

export type CompareAllCandidatesResult = {
  rows: Array<{
    candidateId: string;
    brief: string;
    strengths: string;
    risks: string;
  }>;
  rankingIds: string[];
  topCandidateId: string | null;
  recommendation: string;
};

export async function compareAllCandidates(params: {
  vacancyTitle: string;
  vacancyLevel: string;
  competenciesSummary: string;
  candidatesBundle: string;
}): Promise<CompareAllCandidatesResult> {
  const openai = client();
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Ты опытный HR. По данным нескольких кандидатов на одну вакансию сравни их всех между собой (не попарно — единая картина).

Верни строго JSON:
{
  "rows": [
    {
      "candidateId": string,
      "brief": string,
      "strengths": string,
      "risks": string
    }
  ],
  "rankingIds": string[],
  "topCandidateId": string | null,
  "recommendation": string
}

Правила:
- candidateId в каждой строке rows должен точно совпадать с id из входного блока «Кандидат id=...».
- По одной строке rows на каждого кандидата из входа.
- rankingIds — все id от лучшего соответствия вакансии к худшему.
- topCandidateId — один id предпочтительного кандидата или null, если выбор неочевиден.
- recommendation — 3–7 предложений на русском: кого предпочесть и почему, нюансы и риски.
- brief, strengths, risks — по-русски, кратко и по делу.`,
      },
      {
        role: "user",
        content: `Вакансия: ${params.vacancyTitle}
Уровень: ${params.vacancyLevel}
Описание роли (фрагмент): ${params.competenciesSummary}

ДАННЫЕ ПО КАНДИДАТАМ:
${params.candidatesBundle}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Пустой ответ модели");
  const parsed = JSON.parse(raw) as CompareAllCandidatesResult;
  if (!Array.isArray(parsed.rows)) throw new Error("Некорректный ответ ИИ");
  if (!Array.isArray(parsed.rankingIds)) parsed.rankingIds = [];
  return parsed;
}

export async function narrateDiscrepancies(params: {
  discrepanciesJson: string;
  protocolsText: string;
}): Promise<{ explanations: { blockTitle: string; text: string }[]; tip: string }> {
  const openai = client();
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `По расхождениям оценок и заметкам дай JSON: {
  "explanations": [ { "blockTitle": string, "text": string } ],
  "tip": string (одна рекомендация HR)
} На русском.`,
      },
      {
        role: "user",
        content: `Расхождения (JSON): ${params.discrepanciesJson}\n\nКонтекст заметок:\n${params.protocolsText}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Пустой ответ модели");
  return JSON.parse(raw) as { explanations: { blockTitle: string; text: string }[]; tip: string };
}

export async function regenerateRisksOnly(params: {
  protocolsText: string;
  previousRisks: string[];
}): Promise<{ risks: string[] }> {
  const openai = client();
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: 'Верни JSON { "risks": string[] } — только риски по заметкам, 3–6 пунктов, русский.',
      },
      {
        role: "user",
        content: `Было рисков: ${JSON.stringify(params.previousRisks)}.\n\nЗаметки:\n${params.protocolsText}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Пустой ответ модели");
  return JSON.parse(raw) as { risks: string[] };
}
