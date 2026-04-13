# Деплой: GitHub + Vercel + Neon

Так можно получить рабочую ссылку для демо. **SQLite на Vercel не подходит** (файл БД не сохраняется), поэтому в проекте используется **PostgreSQL**.

## 1. Репозиторий на GitHub

В каталоге проекта (один раз):

```bash
git init
git add .
git commit -m "Initial commit"
```

На [github.com](https://github.com) создайте **новый пустой** репозиторий (без README, если уже есть локальный коммит). Затем:

```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПО.git
git branch -M main
git push -u origin main
```

## 2. База Neon (бесплатно)

1. Зарегистрируйтесь на [neon.tech](https://neon.tech), создайте проект.
2. Скопируйте **Connection string** (PostgreSQL), формат вида  
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → импорт репозитория с GitHub.
2. **Environment Variables** (для Production — и при желании Preview):

| Переменная        | Значение |
|-------------------|----------|
| `DATABASE_URL`    | строка из Neon |
| `NEXTAUTH_URL`    | после первого деплоя будет `https://ваш-проект.vercel.app` (потом обновите и сделайте **Redeploy**) |
| `NEXTAUTH_SECRET` | случайная строка, напр. вывод `openssl rand -base64 32` |
| `OPENAI_API_KEY`  | по желанию, иначе кнопки ИИ будут падать с ошибкой API |

Опционально: `OPENAI_BASE_URL`, `OPENAI_MODEL` (например OpenRouter).

3. **Deploy**. В `package.json` при сборке выполняется `prisma migrate deploy` — таблицы создадутся на Neon при первом билде.

4. После деплоя откройте **Settings → Domains**, скопируйте URL, вернитесь в **Environment Variables**, выставьте `NEXTAUTH_URL` на этот `https://...` и запустите **Redeploy**.

## 4. Демо-данные (один раз)

С локальной машины (или CI), с **тем же** `DATABASE_URL`, что и на Vercel:

```bash
set DATABASE_URL=postgresql://...   # Windows CMD; в PowerShell: $env:DATABASE_URL="..."
npx prisma db seed
```

Либо в Vercel: **Settings → Environment Variables** временно добавьте те же переменные локально в `.env` и выполните `npx prisma db seed`.

После сида: вход **demo@demo.com** / **demo123**.

## 5. Ограничения демо

- Без `OPENAI_API_KEY` не работают вызовы LLM (сводка, план, сравнение кандидатов).
- Публичные ссылки интервью: `https://ВАШ_ДОМЕН/interview/<token>` — домен должен совпадать с тем, что видят интервьюеры (обычно тот же Vercel).

Если что-то не собирается, в логах билда Vercel смотрите шаг `prisma migrate deploy` (часто проблема в `DATABASE_URL` или SSL — для Neon обычно нужен `?sslmode=require`).
