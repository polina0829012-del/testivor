"use client";

import { criticalAppCss } from "@/lib/critical-app-css";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalAppCss }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <div
          style={{
            maxWidth: "28rem",
            margin: "0 auto",
            padding: "2rem 1.25rem",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Критическая ошибка</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", lineHeight: 1.5, color: "hsl(var(--muted))" }}>
            Не удалось загрузить интерфейс. Нажмите кнопку ниже или перезапустите dev-сервер.
          </p>
          {process.env.NODE_ENV === "development" && error.message ? (
            <pre
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                fontSize: "0.75rem",
                lineHeight: 1.45,
                background: "hsl(0 86% 97%)",
                border: "1px solid hsl(0 96% 89%)",
                borderRadius: "0.75rem",
                overflow: "auto",
                color: "hsl(0 63% 31%)",
              }}
            >
              {error.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.125rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.75rem",
              border: "none",
              background: "hsl(var(--accent))",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
