"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "32rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Критическая ошибка</h1>
        <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#666" }}>
          Не удалось загрузить интерфейс. Нажмите кнопку ниже или перезапустите dev-сервер.
        </p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <pre
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              fontSize: "0.75rem",
              background: "#fee",
              borderRadius: "0.5rem",
              overflow: "auto",
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
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            borderRadius: "0.5rem",
            border: "none",
            background: "#171717",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Повторить
        </button>
      </body>
    </html>
  );
}
