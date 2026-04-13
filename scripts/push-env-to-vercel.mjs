#!/usr/bin/env node
/**
 * Pushes selected env vars from .env to a Vercel project (Production + Preview).
 * Requires a personal token: https://vercel.com/account/tokens
 *
 * Usage:
 *   set VERCEL_TOKEN=...                    (Windows CMD)
 *   $env:VERCEL_TOKEN="..."                 (PowerShell)
 *   Optional: VERCEL_PROJECT_NAME, VERCEL_TEAM_ID, VERCEL_PRODUCTION_URL
 *
 *   npm run vercel:push-env
 *   Windows (без npm.ps1): push-vercel-env.cmd из корня репо
 *
 * Токен (любой один способ): VERCEL_TOKEN в окружении, или в .env, или файл .vercel/token.
 * Папка .vercel и .env в .gitignore — в Git не попадут.
 *
 * If you ran `npx vercel link`, .vercel/project.json is used for project + team.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env");

const PLACEHOLDER_SECRET = "generate-with-openssl-rand-base64-32";

/** @param {string} src */
function parseDotEnv(src) {
  /** @type {Record<string, string>} */
  const out = {};
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
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadVercelProjectMeta() {
  const p = resolve(ROOT, ".vercel", "project.json");
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    return {
      projectId: j.projectId,
      orgId: j.orgId,
    };
  } catch {
    return null;
  }
}

/** Токен Vercel: только локально, файл в .gitignore. */
function loadTokenFromFile() {
  const p = resolve(ROOT, ".vercel", "token");
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8").trim();
    return raw.replace(/^\uFEFF/, "") || null;
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(ENV_PATH)) {
    console.error("No .env file at project root.");
    process.exit(1);
  }

  const fileEnv = parseDotEnv(readFileSync(ENV_PATH, "utf8"));

  const token =
    process.env.VERCEL_TOKEN?.trim() ||
    loadTokenFromFile() ||
    fileEnv.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error(
      "Нет токена Vercel.\n" +
        "1) Создайте: https://vercel.com/account/tokens\n" +
        "2) Добавьте в .env строку: VERCEL_TOKEN=\"ваш_токен\" (файл .env не в Git)\n" +
        "   или сохраните токен в .vercel\\token одной строкой\n" +
        "3) Запуск: push-vercel-env.cmd или node scripts\\push-env-to-vercel.mjs"
    );
    process.exit(1);
  }

  const meta = loadVercelProjectMeta();

  const projectIdOrName =
    meta?.projectId ||
    process.env.VERCEL_PROJECT_NAME?.trim() ||
    fileEnv.VERCEL_PROJECT_NAME?.trim() ||
    "testivor";

  const teamId =
    process.env.VERCEL_TEAM_ID?.trim() ||
    fileEnv.VERCEL_TEAM_ID?.trim() ||
    meta?.orgId ||
    undefined;

  const productionUrl =
    process.env.VERCEL_PRODUCTION_URL?.trim() ||
    fileEnv.VERCEL_PRODUCTION_URL?.trim();
  let nextAuthUrl = fileEnv.NEXTAUTH_URL || "";
  if (productionUrl) {
    nextAuthUrl = productionUrl.replace(/\/$/, "");
  }

  let nextAuthSecret = fileEnv.NEXTAUTH_SECRET || "";
  if (!nextAuthSecret || nextAuthSecret === PLACEHOLDER_SECRET) {
    nextAuthSecret = randomBytes(32).toString("base64");
    console.log(
      "NEXTAUTH_SECRET was missing or placeholder — generated a new secret for Vercel."
    );
  }

  const databaseUrl = fileEnv.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(".env must contain DATABASE_URL.");
    process.exit(1);
  }

  const directUrl = fileEnv.DIRECT_URL?.trim() || databaseUrl;

  /** @type {{ key: string; value: string; type: 'sensitive' | 'plain' }[]} */
  const entries = [
    { key: "DATABASE_URL", value: databaseUrl, type: "sensitive" },
    { key: "DIRECT_URL", value: directUrl, type: "sensitive" },
    { key: "NEXTAUTH_SECRET", value: nextAuthSecret, type: "sensitive" },
  ];

  if (nextAuthUrl) {
    entries.push({
      key: "NEXTAUTH_URL",
      value: nextAuthUrl,
      type: "plain",
    });
  }

  const optionalKeys = [
    "OPENAI_API_KEY",
    "LLM_API_KEY",
    "AI_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_MODEL",
    "OPENROUTER_HTTP_REFERER",
    "OPENROUTER_APP_TITLE",
    "OPENAI_TIMEOUT_MS",
    // не отправляем на Vercel:
    // "VERCEL_TOKEN", "VERCEL_PROJECT_NAME", "VERCEL_TEAM_ID", "VERCEL_PRODUCTION_URL"
  ];
  for (const k of optionalKeys) {
    const v = fileEnv[k]?.trim();
    if (v) {
      entries.push({
        key: k,
        value: v,
        type:
          k === "OPENAI_API_KEY" ||
          k === "LLM_API_KEY" ||
          k === "AI_API_KEY" ||
          k === "OPENROUTER_API_KEY"
            ? "sensitive"
            : "plain",
      });
    }
  }

  const usesOpenRouter =
    Boolean(fileEnv.OPENROUTER_API_KEY?.trim()) ||
    (fileEnv.OPENAI_BASE_URL?.trim() || "").includes("openrouter.ai");
  if (nextAuthUrl && usesOpenRouter && !fileEnv.OPENROUTER_HTTP_REFERER?.trim()) {
    entries.push({
      key: "OPENROUTER_HTTP_REFERER",
      value: nextAuthUrl,
      type: "plain",
    });
    console.log("OPENROUTER_HTTP_REFERER set from production URL (OpenRouter).");
  }

  const target = ["production", "preview"];
  const body = entries.map((e) => ({
    key: e.key,
    value: e.value,
    type: e.type,
    target,
  }));

  const q = new URLSearchParams();
  q.set("upsert", "true");
  if (teamId) q.set("teamId", teamId);

  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(
    projectIdOrName
  )}/env?${q.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  if (!res.ok) {
    console.error("Vercel API error", res.status, json);
    process.exit(1);
  }

  console.log("OK — variables upserted on Vercel for:", projectIdOrName);
  if (json?.created?.length) {
    for (const c of json.created) {
      console.log("  -", c.key, c.target?.join?.(", ") || "");
    }
  } else if (process.env.DEBUG_VERCEL_ENV) {
    console.log(JSON.stringify(json, null, 2));
  }
  if (json?.failed?.length) {
    console.error("Some failed:", json.failed);
    process.exit(1);
  }

  if (!productionUrl && nextAuthUrl.includes("localhost")) {
    console.log(
      "\nNEXTAUTH_URL is still localhost. After the first deploy, set your real URL:\n" +
        "  $env:VERCEL_PRODUCTION_URL=\"https://YOUR-PROJECT.vercel.app\"\n" +
        "  npm run vercel:push-env\n" +
        "Or change it in Vercel → Settings → Environment Variables and Redeploy."
    );
  } else {
    console.log("\nNext: Vercel → Deployments → Redeploy (or push a commit).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
