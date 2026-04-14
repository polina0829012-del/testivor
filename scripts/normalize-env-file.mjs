#!/usr/bin/env node
/**
 * Нормализует .env: LF вместо CRLF, убирает BOM, заменяет плейсхолдер NEXTAUTH_SECRET.
 * npm run env:normalize
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env");

if (!existsSync(ENV_PATH)) {
  console.log("Нет файла .env — пропуск.");
  process.exit(0);
}

let s = readFileSync(ENV_PATH, "utf8");
if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

if (s.includes("generate-with-openssl-rand-base64-32")) {
  const sec = randomBytes(32).toString("base64");
  s = s.replace(
    /NEXTAUTH_SECRET=["']generate-with-openssl-rand-base64-32["']/,
    `NEXTAUTH_SECRET="${sec}"`,
  );
  console.log("NEXTAUTH_SECRET обновлён (не используйте плейсхолдер в проде).");
}

writeFileSync(ENV_PATH, s.endsWith("\n") ? s : `${s}\n`, "utf8");
console.log(".env нормализован (переносы строк, BOM).");
