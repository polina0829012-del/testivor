# Interview Intelligence Platform

Веб-сервис для структурирования интервью: план вопросов (в т.ч. с AI), протоколы интервьюеров по ссылке, расхождения в оценках (правило **> 2 балла** считается в коде), AI-сводка и рекомендация, дашборд по вакансии, выгрузка CSV. Данные изолированы по HR-пользователю (email + пароль).

## Стек

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Prisma** + **PostgreSQL** (`DATABASE_URL`; локально — Docker, [Neon](https://neon.tech) и т.п.)
- **NextAuth** (Credentials, JWT)
- **OpenAI-compatible API** (`OPENAI_API_KEY`, опционально `OPENAI_BASE_URL`, `OPENAI_MODEL`)

## Быстрый старт

1. Установите [Node.js](https://nodejs.org/) LTS.
2. Окружение:

   - В корне файл **`.env`** с `DATABASE_URL` (PostgreSQL) и `NEXTAUTH_*`.
   - Секреты ИИ можно держать в **`.env.local`** — Next.js подхватывает оба файла.

   Если `.env` ещё нет: скопируйте `.env.example` в `.env`, укажите строку подключения к Postgres и `NEXTAUTH_SECRET` (например `openssl rand -base64 32`).

3. Установите зависимости и базу:

   ```bash
   npm install
   npx prisma migrate deploy
   npm run db:seed
   ```

   После **изменений в `schema.prisma`**: `npx prisma migrate dev --name описание` (локально), затем закоммитьте папку `prisma/migrations`.

4. Запуск:

   ```bash
   npm run dev
   ```

5. Откройте [http://localhost:3000](http://localhost:3000). Демо-аккаунт после сида: **demo@demo.com** / **demo123**. Пригласительные ссылки для протоколов: токены `invite-demo-maria`, `invite-demo-oleg`, `invite-demo-irina` (см. карточку кандидата или `prisma/seed.ts`).

## Архитектура (кратко)

- `src/app/(main)/` — кабинет HR: дашборд, **создание вакансии** (`/vacancies/new`), страница вакансии (KPI, план, кандидаты), карточка кандидата (протоколы, AI, расхождения). У вакансии: приоритет, статус, срок закрытия, формат работы, единое поле «компетенции и пожелания к кандидату» (для рекрутера, карточки и ИИ), внутренняя заметка HR.
- `src/app/interview/[token]/` — публичная форма протокола для интервьюера.
- `src/actions/*` — server actions (мутации, AI).
- `src/lib/discrepancies.ts` — детерминированный расчёт расхождений.
- `src/lib/ai.ts` — вызовы LLM (JSON-ответы).
- `src/app/api/vacancies/[id]/export` — выгрузка CSV (сессия HR).

## Деплой

Пошагово: **[DEPLOY.md](./DEPLOY.md)** (GitHub + Vercel + Neon, переменные окружения, сид демо).

## Phase 3 (не в этом репозитории)

По договорённости: ATS, календарь, email, i18n — остаются на потом.

## История промптов

См. `prompts.md` — туда переносите промпты к AI-агенту при работе над проектом.
