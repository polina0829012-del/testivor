import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function mergedEnv() {
  const env = { ...process.env };
  const direct = env.DIRECT_URL && String(env.DIRECT_URL).trim();
  if (!direct && env.DATABASE_URL) {
    env.DIRECT_URL = env.DATABASE_URL;
  }
  return env;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: mergedEnv(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["next", "build"]);
