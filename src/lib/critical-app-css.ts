/**
 * Минимальные токены и стили страницы до загрузки сгенерированного CSS из globals.css.
 * Дублирует значения из globals.css — при сбое загрузки /_next/static/...css страница не «голая».
 */
export const criticalAppCss = `
:root {
  --background: 220 20% 97%;
  --foreground: 230 25% 12%;
  --surface: 0 0% 100%;
  --muted: 230 12% 46%;
  --accent: 226 70% 55%;
  --ring: 226 70% 55%;
}
.dark {
  color-scheme: dark;
  --background: 230 22% 9%;
  --foreground: 210 20% 96%;
  --surface: 230 18% 12%;
  --muted: 215 14% 65%;
  --accent: 217 91% 60%;
  --ring: 217 91% 60%;
}
html {
  color-scheme: light dark;
}
body {
  margin: 0;
  min-height: 100vh;
  font-family: var(--font-sans, system-ui), system-ui, -apple-system, "Segoe UI", sans-serif;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`.trim();
