# Interview Intelligence Platform

Веб-сервис для структурирования интервью: план вопросов (в т.ч. с AI), протоколы интервьюеров по ссылке, расхождения в оценках (правило **> 2 балла** считается в коде), AI-сводка и рекомендация, дашборд по вакансии, выгрузка CSV. Данные изолированы по HR-пользователю (email + пароль).

## Стек

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Prisma** + **PostgreSQL** (`DATABASE_URL`; локально — Docker, [Neon](https://neon.tech) и т.п.)
- **NextAuth** (Credentials, JWT)
- **OpenAI-compatible API**: ключ в `OPENAI_API_KEY` или `LLM_API_KEY` / `AI_API_KEY` / `OPENROUTER_API_KEY`; опционально `OPENAI_BASE_URL`, `OPENAI_MODEL` (дефолт — **gpt-4o-mini** или **openai/gpt-4o-mini** на OpenRouter). На **Vercel** те же переменные задаются в панели проекта (**Environment Variables → Production**), иначе ИИ работает только у вас локально, а не у гостей по ссылке.

## Быстрый старт

1. Установите [Node.js](https://nodejs.org/) LTS.
2. Зависимости: `npm install`.
3. **Самый простой локальный вариант** (нужен [Docker Desktop](https://www.docker.com/products/docker-desktop/)) — одна команда поднимает Postgres, создаст/починит `.env`, миграции и сид:

   ```bash
   npm run bootstrap
   ```

4. Запуск:

   ```bash
   npm run dev
   ```

   Без Docker: в корне файл **`.env`** с реальным `DATABASE_URL` (Neon и т.д.) и `NEXTAUTH_SECRET`. Можно скопировать `.env.example` → `.env` и заполнить вручную, затем `npx prisma migrate deploy` и `npm run db:seed`.

   После **изменений в `schema.prisma`**: `npx prisma migrate dev --name описание` (локально), затем закоммитьте папку `prisma/migrations`.

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
