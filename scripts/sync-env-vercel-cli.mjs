#!/usr/bin/env node
/**
 * Синхронизирует переменные из .env в Vercel через CLI (достаточно `vercel login`).
 * Не требует VERCEL_TOKEN. На Windows значение передаётся через временный файл и stdin (cmd),
 * на macOS/Linux — `npx vercel env add … --value …`.
 *
 * По умолчанию: LLM/OpenRouter + опционально DIRECT_URL.
 * Только **Production** (у Preview в новом CLI Vercel нужна отдельная git-ветка).
 * NEXTAUTH_URL с localhost в .env не перезаписывает прод (чтобы не сломать деплой).
 *
 * npm run vercel:sync-env-cli
 * node scripts/sync-env-vercel-cli.mjs --all   — также DATABASE_URL, NEXTAUTH_*
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
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
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string} value
 * @param {boolean} sensitive
 */
function vercelEnvAddProduction(key, value, sensitive) {
  const args = [
    "vercel",
    "env",
    "add",
    key,
    "production",
    "--value",
    value,
    "--yes",
    "--force",
  ];
  if (sensitive) args.push("--sensitive");

  if (process.platform === "win32") {
    const tmp = join(
      tmpdir(),
      `vercel-env-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    );
    writeFileSync(tmp, value.replace(/\r?\n/g, ""), "utf8");
    const sens = sensitive ? " --sensitive" : "";
    const quotedTmp = tmp.includes(" ") ? `"${tmp}"` : tmp;
    const cmd = `npx vercel env add ${key} production --yes --force${sens} < ${quotedTmp}`;
    const r = spawnSync("cmd.exe", ["/d", "/s", "/c", cmd], {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      windowsHide: true,
    });
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    if (r.status !== 0) {
      console.error(
        `Failed: ${key} (production)\n${r.stderr || ""}${r.stdout || ""}`
      );
      return false;
    }
    console.log(`OK ${key} → production`);
    return true;
  }

  try {
    execFileSync("npx", args, {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      windowsHide: true,
    });
    console.log(`OK ${key} → production`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed: ${key} (production)\n${msg}`);
    return false;
  }
}

async function main() {
  const all = process.argv.includes("--all");
  if (!existsSync(ENV_PATH)) {
    console.error("Нет файла .env в корне проекта.");
    process.exit(1);
  }
  if (!existsSync(resolve(ROOT, ".vercel", "project.json"))) {
    console.error(
      "Нет привязки к Vercel. Выполните: npx vercel link --yes --project testivor"
    );
    process.exit(1);
  }

  const fileEnv = parseDotEnv(readFileSync(ENV_PATH, "utf8"));
  const meta = loadVercelProjectMeta();
  const projectHint = meta?.projectName || "testivor";
  const defaultProdUrl = `https://${projectHint}.vercel.app`;

  const productionUrl =
    fileEnv.VERCEL_PRODUCTION_URL?.trim() || fileEnv.NEXTAUTH_URL?.trim() || "";
  const nextAuthUrl =
    productionUrl && !/localhost|127\.0\.0\.1/i.test(productionUrl)
      ? productionUrl.replace(/\/$/, "")
      : "";

  let nextAuthSecret = fileEnv.NEXTAUTH_SECRET || "";
  if (
    all &&
    (!nextAuthSecret || nextAuthSecret === PLACEHOLDER_SECRET)
  ) {
    nextAuthSecret = randomBytes(32).toString("base64");
    console.log("Сгенерирован новый NEXTAUTH_SECRET для Vercel (--all).");
  }

  const databaseUrl = fileEnv.DATABASE_URL?.trim();
  const directUrl = fileEnv.DIRECT_URL?.trim() || databaseUrl || "";

  /** @type {{ key: string; value: string; sensitive: boolean }[]} */
  const entries = [];

  if (all && databaseUrl) {
    entries.push({ key: "DATABASE_URL", value: databaseUrl, sensitive: true });
    entries.push({ key: "DIRECT_URL", value: directUrl, sensitive: true });
    if (nextAuthSecret)
      entries.push({
        key: "NEXTAUTH_SECRET",
        value: nextAuthSecret,
        sensitive: true,
      });
    if (nextAuthUrl)
      entries.push({ key: "NEXTAUTH_URL", value: nextAuthUrl, sensitive: false });
  } else {
    if (directUrl && directUrl !== databaseUrl) {
      entries.push({ key: "DIRECT_URL", value: directUrl, sensitive: true });
    }
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
  ];
  for (const k of optionalKeys) {
    const v = fileEnv[k]?.trim();
    if (v)
      entries.push({
        key: k,
        value: v,
        sensitive:
          k === "OPENAI_API_KEY" ||
          k === "LLM_API_KEY" ||
          k === "AI_API_KEY" ||
          k === "OPENROUTER_API_KEY",
      });
  }

  const usesOpenRouter =
    Boolean(fileEnv.OPENROUTER_API_KEY?.trim()) ||
    (fileEnv.OPENAI_BASE_URL?.trim() || "").includes("openrouter.ai");
  const hasReferer = entries.some((e) => e.key === "OPENROUTER_HTTP_REFERER");
  if (usesOpenRouter && !hasReferer) {
    const ref = nextAuthUrl || defaultProdUrl;
    entries.push({
      key: "OPENROUTER_HTTP_REFERER",
      value: ref,
      sensitive: false,
    });
    console.log(`OPENROUTER_HTTP_REFERER → ${ref} (OpenRouter)`);
  }

  if (!entries.length) {
    console.error(
      "В .env нет значений для отправки (ключи LLM пустые?). Заполните OPENAI_API_KEY или OPENROUTER_API_KEY."
    );
    process.exit(1);
  }

  let ok = true;
  for (const e of entries) {
    if (!vercelEnvAddProduction(e.key, e.value, e.sensitive)) ok = false;
  }

  if (!ok) process.exit(1);
  console.log(
    "\nГотово (только Production). Vercel → Deployments → Redeploy последнего прод-деплоя (или: npx vercel --prod)."
  );
  console.log(
    "Preview-деплои: скопируйте те же переменные в Vercel → Settings → Environment Variables → Preview, либо npm run vercel:push-env с токеном."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
