import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Парсинг .env без зависимости dotenv — подхватываем БД, если процесс стартовал без переменных (cwd, IDE). */
function parseDotEnv(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of src.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    out[key] = val;
  }
  return out;
}

function hydrateDatabaseUrlFromRootEnvFile() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  const looksOk =
    rawUrl &&
    (rawUrl.startsWith("postgresql://") || rawUrl.startsWith("postgres://"));
  if (looksOk) return;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  let text = readFileSync(envPath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const vars = parseDotEnv(text);
  const db = vars.DATABASE_URL?.trim();
  const direct = vars.DIRECT_URL?.trim();
  if (
    db &&
    (db.startsWith("postgresql://") || db.startsWith("postgres://"))
  ) {
    process.env.DATABASE_URL = db;
  }
  if (
    direct &&
    (direct.startsWith("postgresql://") || direct.startsWith("postgres://"))
  ) {
    process.env.DIRECT_URL = direct;
  } else if (db && !process.env.DIRECT_URL?.trim()) {
    process.env.DIRECT_URL = db;
  }
}

function assertDatabaseUrl() {
  hydrateDatabaseUrlFromRootEnvFile();
  const raw = process.env.DATABASE_URL?.trim();
  if (
    !raw ||
    (!raw.startsWith("postgresql://") && !raw.startsWith("postgres://"))
  ) {
    throw new Error(
      "В .env не задан корректный DATABASE_URL. Нужна строка подключения PostgreSQL, начинающаяся с postgresql:// или postgres:// " +
        "(например из Neon: панель проекта → Connection string). Скопируйте в .env как DATABASE_URL=\"...\". См. .env.example. " +
        "Локально без облака: установите Docker и выполните npm run bootstrap."
    );
  }
}

assertDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
