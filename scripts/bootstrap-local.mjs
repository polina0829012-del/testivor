#!/usr/bin/env node
/**
 * Поднимает Docker Postgres, при необходимости создаёт/чинит .env (DATABASE_URL),
 * применяет миграции и сид. Нужен установленный Docker Desktop.
 *
 * npm run bootstrap
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env");
const EXAMPLE_PATH = resolve(ROOT, ".env.example");

const DOCKER_DB_URL =
  "postgresql://testivor:testivor@127.0.0.1:5433/testivor?schema=public";

/** @param {string} content */
function parseEnv(content) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/** @param {string} key @param {string} value */
function fmtLine(key, value) {
  return `${key}="${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * @param {string} content
 * @param {string} key
 * @param {string} value
 */
function upsertEnvFile(content, key, value) {
  const lines = content.split(/\r?\n/);
  let found = false;
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) return line;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m && m[1] === key) {
      found = true;
      return fmtLine(key, value);
    }
    return line;
  });
  if (!found) {
    if (out.length && out[out.length - 1].trim() !== "") out.push("");
    out.push(fmtLine(key, value));
  }
  return out.join("\n");
}

/** @param {string | undefined} u */
function isValidPostgresUrl(u) {
  return (
    typeof u === "string" &&
    (u.startsWith("postgresql://") || u.startsWith("postgres://"))
  );
}

/** @param {string | undefined} u */
function isPlaceholderUrl(u) {
  if (!u) return true;
  if (u.includes("USER:PASSWORD")) return true;
  if (u.includes("@HOST")) return true;
  return false;
}

function waitPort(host, port, ms = 120000) {
  const deadline = Date.now() + ms;
  return /** @type {Promise<void>} */ (
    new Promise((resolvePromise, reject) => {
      const tryConnect = () => {
        if (Date.now() > deadline) {
          reject(new Error(`Таймаут: не открылся порт ${host}:${port}`));
          return;
        }
        const socket = net.connect(port, host, () => {
          socket.end();
          resolvePromise();
        });
        socket.on("error", () => {
          socket.destroy();
          setTimeout(tryConnect, 400);
        });
      };
      tryConnect();
    })
  );
}

function runDockerComposeUp() {
  const tryCmd = (args) =>
    spawnSync(args[0], args.slice(1), {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

  let r = tryCmd(["docker", "compose", "up", "-d"]);
  if (r.status !== 0) {
    r = tryCmd(["docker-compose", "up", "-d"]);
  }
  if (r.status !== 0) {
    console.error(
      "\nНе удалось выполнить docker compose. Установите Docker Desktop, запустите его и снова: npm run bootstrap\n"
    );
    process.exit(1);
  }
}

async function main() {
  console.log("Запуск PostgreSQL в Docker…");
  runDockerComposeUp();

  console.log("Ожидание порта 5433…");
  await waitPort("127.0.0.1", 5433);

  let content = "";
  if (existsSync(ENV_PATH)) {
    content = readFileSync(ENV_PATH, "utf8");
  } else if (existsSync(EXAMPLE_PATH)) {
    content = readFileSync(EXAMPLE_PATH, "utf8");
    console.log("Создаю .env из .env.example…");
  } else {
    content = `${fmtLine("NEXTAUTH_URL", "http://localhost:3000")}\n`;
  }

  const env = parseEnv(content);
  const currentUrl = env.DATABASE_URL?.trim();

  const keepRemote =
    isValidPostgresUrl(currentUrl) &&
    !isPlaceholderUrl(currentUrl) &&
    !currentUrl.includes("127.0.0.1:5433") &&
    !currentUrl.includes("localhost:5433");

  if (keepRemote) {
    console.log("Оставляю существующий DATABASE_URL (удалённая БД).");
  } else {
    content = upsertEnvFile(content, "DATABASE_URL", DOCKER_DB_URL);
    content = upsertEnvFile(content, "DIRECT_URL", DOCKER_DB_URL);
    console.log("Записан DATABASE_URL для локального Docker (127.0.0.1:5433).");
  }

  const secret = env.NEXTAUTH_SECRET?.trim() || "";
  const badSecret =
    !secret || secret === "generate-with-openssl-rand-base64-32";
  if (badSecret) {
    content = upsertEnvFile(
      content,
      "NEXTAUTH_SECRET",
      randomBytes(32).toString("base64"),
    );
    console.log("Сгенерирован NEXTAUTH_SECRET.");
  }

  if (!parseEnv(content).NEXTAUTH_URL?.trim()) {
    content = upsertEnvFile(content, "NEXTAUTH_URL", "http://localhost:3000");
  }

  writeFileSync(ENV_PATH, content.replace(/\s+$/, "") + "\n", "utf8");

  console.log("Применяю миграции Prisma…");
  execSync("npx prisma migrate deploy", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...parseEnv(readFileSync(ENV_PATH, "utf8")) },
  });

  console.log("Сид демо-данных…");
  execSync("npx prisma db seed", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...parseEnv(readFileSync(ENV_PATH, "utf8")) },
  });

  console.log("\nГотово. Запуск приложения: npm run dev\nДемо: demo@demo.com / demo123\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
