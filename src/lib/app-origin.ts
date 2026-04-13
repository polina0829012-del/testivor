import { headers } from "next/headers";

/** Базовый URL приложения для ссылок в UI (учитывает реальный порт в dev, напр. :3002). */
export function getRequestOrigin(): string {
  const h = headers();
  const host = h.get("host");
  if (host) {
    const forwarded = h.get("x-forwarded-proto");
    const proto =
      forwarded ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  const fromEnv = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "http://localhost:3000";
}
