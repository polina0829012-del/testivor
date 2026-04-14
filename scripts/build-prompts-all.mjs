/**
 * Собирает полную историю промптов из транскрипта Cursor (JSONL).
 * Запуск: node scripts/build-prompts-all.mjs
 * Результат: ../PROMPTS_ALL.md (в корне репозитория)
 *
 * Переменная TRANSCRIPT — путь к .jsonl, если нестандартное расположение.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultTranscript = path.join(
  "C:",
  "Users",
  "polin",
  ".cursor",
  "projects",
  "c-Users-polin-OneDrive-testovoe",
  "agent-transcripts",
  "e3cc1d00-1e95-4829-87a3-de3dab3803b0",
  "e3cc1d00-1e95-4829-87a3-de3dab3803b0.jsonl"
);
const transcript = process.env.TRANSCRIPT || defaultTranscript;
const outMd = path.join(root, "PROMPTS_ALL.md");

function sanitize(s) {
  return s
    .replace(/\bsk-or-v1-[a-f0-9]+\b/gi, "[API-ключ удалён — хранить только в .env, не в репозитории]")
    .replace(/\bsk-[a-zA-Z0-9]{20,}\b/g, "[API-ключ удалён]")
    .replace(/\bvcp_[A-Za-z0-9]+\b/g, "[Vercel token удалён — не коммитить, см. vercel.com/account/tokens]");
}

if (!fs.existsSync(transcript)) {
  console.error("Transcript not found:", transcript);
  console.error("Set TRANSCRIPT=... or place JSONL in expected Cursor path.");
  process.exit(1);
}

const lines = fs.readFileSync(transcript, "utf8").split(/\r?\n/).filter(Boolean);
const prompts = [];
for (const line of lines) {
  try {
    const o = JSON.parse(line);
    if (o.role !== "user" || !o.message?.content) continue;
    const t = o.message.content.find((c) => c.type === "text")?.text;
    if (!t || !t.includes("<user_query>")) continue;
    const start = t.indexOf("<user_query>") + "<user_query>".length;
    const end = t.indexOf("</user_query>");
    if (end === -1) continue;
    const body = sanitize(t.slice(start, end).trim());
    if (body) prompts.push(body);
  } catch {
    /* skip */
  }
}

const deduped = [];
let prev = null;
for (const p of prompts) {
  if (p === prev) continue;
  deduped.push(p);
  prev = p;
}

const header = `# Полная история промптов к AI-агенту (Cursor)

Источник: экспорт транскрипта чата Cursor (\`jsonl\`), **${new Date().toISOString().slice(0, 10)}**.

Подряд идущие **точные дубликаты** одного сообщения убраны (осталось **${deduped.length}** уникальных шагов из **${prompts.length}** записей). Секреты в тексте заменены на плейсхолдеры.

Для сдачи можно приложить этот файл целиком или краткую выжимку — [prompts.md](./prompts.md).

---

`;

const body = deduped
  .map(
    (p, i) =>
      `## Промпт ${i + 1}\n\n${p.split("\n").map((line) => (line.trim() === "" ? "" : line)).join("\n")}\n`
  )
  .join("\n---\n\n");

fs.writeFileSync(outMd, header + body, "utf8");
console.log("Wrote", outMd, "|", deduped.length, "prompts");
