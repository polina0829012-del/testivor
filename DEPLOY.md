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

### 3a. Переменные окружения автоматически (из `.env`)

Если не хотите вводить их вручную в панели Vercel:

1. Создайте токен: [vercel.com/account/tokens](https://vercel.com/account/tokens) (показывается один раз — сохраните).
2. В корне проекта должен быть `.env` с `DATABASE_URL` (и по желанию остальным).
3. Один раз можно выполнить `npx vercel link` и выбрать этот проект — тогда скрипт возьмёт id проекта из `.vercel/project.json` (папка в `.gitignore`, в Git не попадает).
4. Токен и запуск скрипта:

- В **`.env`** строка `VERCEL_TOKEN="…"` (файл в `.gitignore`), **или** файл **`.vercel/token`** (одна строка).
- Запуск из корня: **`push-vercel-env.cmd`** — только `node`, без `npm.ps1`. Альтернативы: **`npm.cmd run vercel:push-env`** или **`node scripts/push-env-to-vercel.mjs`**.

```powershell
# по желанию — всё ещё через переменную:
$env:VERCEL_TOKEN="ВАШ_ТОКЕН"
# если имя проекта на Vercel не testivor:
# $env:VERCEL_PROJECT_NAME="имя-как-в-dashboard"
npm.cmd run vercel:push-env
```

Скрипт выставит `DATABASE_URL`, `NEXTAUTH_SECRET` (если в `.env` был плейсхолдер — сгенерирует новый для Vercel), `NEXTAUTH_URL` и опциональные `OPENAI_*`. Цели: **Production** и **Preview**.

После первого успешного деплоя задайте реальный домен и снова запустите скрипт:

```powershell
$env:VERCEL_TOKEN="ВАШ_ТОКЕН"
$env:VERCEL_PRODUCTION_URL="https://ваш-проект.vercel.app"
npm.cmd run vercel:push-env
```

Затем **Redeploy** в Vercel.

### 3b. Вручную в панели

1. **Environment Variables** (для Production — и при желании Preview):

| Переменная        | Значение |
|-------------------|----------|
| `DATABASE_URL`    | строка из Neon |
| `DIRECT_URL`      | опционально: для Prisma migrate; если не задать, при сборке подставится из `DATABASE_URL`. Отдельный direct/host без pooler в Neon — только если миграции с pooled URL падают |
| `NEXTAUTH_URL`    | после первого деплоя будет `https://ваш-проект.vercel.app` (потом обновите и сделайте **Redeploy**) |
| `NEXTAUTH_SECRET` | случайная строка, напр. вывод `openssl rand -base64 32` |
| `OPENAI_API_KEY`  | по желанию; вместо неё подойдут **`LLM_API_KEY`**, **`AI_API_KEY`** или **`OPENROUTER_API_KEY`** (достаточно одного ключа) |
| `OPENAI_BASE_URL` | если не OpenAI: OpenRouter — `https://openrouter.ai/api/v1` (при только `OPENROUTER_API_KEY` подставится сам) |
| `OPENAI_MODEL`    | на OpenRouter часто `openai/gpt-4o-mini`; на прямом OpenAI можно не задавать (дефолт в коде) |

Кнопки ИИ без ключа будут отвечать ошибкой. Скрипт `vercel:push-env` выгружает и альтернативные имена ключей из `.env`.

Скрипт `npm run vercel:push-env` сам добавляет `DIRECT_URL` (копия `DATABASE_URL`, если в `.env` не задано).

2. **Deploy**. После `npm install` выполняется `postinstall` → `prisma generate`; при сборке — `node scripts/vercel-build.mjs` (миграции + `next build`; без `DIRECT_URL` в панели Vercel он берётся из `DATABASE_URL`). Ветка **Production** в Vercel должна быть **`main`**.

### Если в Vercel: «No Production Deployment»

Все билды в **Deployments** со статусом **Error** — откройте логи. Частые причины: нет **`DATABASE_URL`** для **Production**, или миграции не проходят к Neon. `DIRECT_URL` для билда не обязателен, если задан `DATABASE_URL`. После правки env сделайте **Redeploy** или пуш в `main`.

3. После деплоя откройте **Settings → Domains**, скопируйте URL, вернитесь в **Environment Variables**, выставьте `NEXTAUTH_URL` на этот `https://...` и запустите **Redeploy**.

## 4. Демо-данные (один раз)

С локальной машины (или CI), с **тем же** `DATABASE_URL`, что и на Vercel:

```bash
set DATABASE_URL=postgresql://...   # Windows CMD; в PowerShell: $env:DATABASE_URL="..."
npx prisma db seed
```

Либо в Vercel: **Settings → Environment Variables** временно добавьте те же переменные локально в `.env` и выполните `npx prisma db seed`.

После сида: вход **demo@demo.com** / **demo123**.

## 5. Ограничения демо

- Без ключа LLM (`OPENAI_API_KEY` или альтернативы из таблицы выше) не работают вызовы ИИ (сводка, план, сравнение кандидатов).
- Публичные ссылки интервью: `https://ВАШ_ДОМЕН/interview/<token>` — домен должен совпадать с тем, что видят интервьюеры (обычно тот же Vercel).

Если что-то не собирается, в логах билда Vercel смотрите шаг `prisma migrate deploy` (`DATABASE_URL`, `DIRECT_URL`, SSL — для Neon обычно `?sslmode=require`).
