## Цель

Полный переезд с Supabase Cloud на ваш сервер. Никаких облачных зависимостей. На фронте меняется буквально 2 переменные окружения — вся бизнес-логика (`supabase.from(...)`, `supabase.auth`, RLS, триггеры, edge-функции) продолжает работать.

## Архитектура (docker-compose на вашем сервере)

```text
┌─────────────────────────────────────────────────────────┐
│ Браузер пользователя                                    │
│   → https://legche.online (Vite SPA, статика)           │
└──────────────┬──────────────────────────────────────────┘
               │ VITE_SUPABASE_URL=https://api.legche.online
               ▼
┌─────────────────────────────────────────────────────────┐
│ kong (8000)         — API Gateway, маршрутизация        │
│   ├─► gotrue        — /auth/v1/*    (email/Google/Apple)│
│   ├─► postgrest     — /rest/v1/*    (CRUD + RLS)        │
│   ├─► realtime      — /realtime/v1/*                    │
│   ├─► storage-api   — /storage/v1/* (если нужно)        │
│   └─► api (наш)     — /functions/v1/* (DeepSeek и пр.)  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ db: postgres:15 (ваш контейнер)                         │
│   user=inga_db_user / db=postgres / volume=legche_pgdata│
│   схемы: public, auth, storage, realtime, _analytics    │
└─────────────────────────────────────────────────────────┘
```

Используются **официальные образы** Supabase — никакого форка, никакого риска расхождения с API.

## Что меняется

### 1. `docker-compose.yml` — добавляются сервисы

- `db` — `supabase/postgres:15.x` вместо чистого `postgres:16-alpine` (нужны расширения: `pgjwt`, `pgcrypto`, `pg_graphql`, `pgsodium`, `pg_net`). **Совместим с вашими настройками**: `POSTGRES_USER=inga_db_user`, `POSTGRES_PASSWORD=67hhhVKHD4`, `POSTGRES_DB=postgres`, том `legche_pgdata`, порт `5432`.
- `auth` — `supabase/gotrue` (signup, login, JWT, password reset, OAuth Google/Apple).
- `rest` — `postgrestorg/postgrest` (генерирует REST из public-схемы, уважает RLS).
- `realtime` — `supabase/realtime` (для будущих подписок).
- `storage` — `supabase/storage-api` (можно отключить, если не нужно — у вас сейчас 0 бакетов).
- `kong` — `kong:2.8` с конфигом, который маршрутизирует `/auth/v1`, `/rest/v1`, `/realtime/v1`, `/storage/v1`, `/functions/v1`.
- `api` (наш Node-сервер) — остаётся, переезжает на путь `/functions/v1/*` для DeepSeek, `ask-inga`, `estimate-nutrition`, `start-trial`.
- `studio` (опционально) — `supabase/studio`, веб-админка для базы на `:3001`.

### 2. Миграция схемы в self-hosted Postgres

Создаётся `server/migrations/000_init.sql` — забирает все ваши текущие миграции из `supabase/migrations/*.sql` и применяется через init-volume один раз при пустой БД. RLS, триггеры, `handle_new_user`, `has_role`, ENUMы — переносятся 1-в-1.

Для миграции **существующих данных** из Supabase Cloud: разовый скрипт `scripts/migrate-from-cloud.sh` с `pg_dump --data-only --schema=public,auth` → `psql` в новый контейнер.

### 3. Генерация ключей и JWT

Скрипт `scripts/generate-keys.sh` создаёт:
- `JWT_SECRET` (32+ байта)
- `ANON_KEY` (JWT с role=anon, подписан JWT_SECRET)
- `SERVICE_ROLE_KEY` (JWT с role=service_role)

Эти ключи попадают в `.env` и используются всеми сервисами.

### 4. `.env.example` (новый)

```bash
# ── Domain ─────────────────────────────────────
SITE_URL=https://legche.online
API_EXTERNAL_URL=https://api.legche.online

# ── Postgres ───────────────────────────────────
POSTGRES_USER=inga_db_user
POSTGRES_PASSWORD=67hhhVKHD4
POSTGRES_DB=postgres
DATABASE_URL=postgresql://inga_db_user:67hhhVKHD4@db:5432/postgres

# ── Supabase self-hosted ───────────────────────
JWT_SECRET=<generate via scripts/generate-keys.sh>
ANON_KEY=<generated JWT>
SERVICE_ROLE_KEY=<generated JWT>

# ── Auth (GoTrue) ──────────────────────────────
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_MAILER_AUTOCONFIRM=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=Inga
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=
GOTRUE_EXTERNAL_GOOGLE_SECRET=
GOTRUE_EXTERNAL_APPLE_ENABLED=true
GOTRUE_EXTERNAL_APPLE_CLIENT_ID=
GOTRUE_EXTERNAL_APPLE_SECRET=

# ── DeepSeek (наш api) ─────────────────────────
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# ── Frontend (build-time) ──────────────────────
VITE_SUPABASE_URL=https://api.legche.online
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=self-hosted
```

### 5. Фронтенд

**Изменений в коде — ноль.** `src/integrations/supabase/client.ts` уже читает `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY` из env — этого достаточно. Меняется только `.env` при сборке/деплое.

### 6. Edge-функции

Существующие функции в `supabase/functions/*` (ask-inga, deepseek, estimate-nutrition, start-trial) уже продублированы в `server/*.js`. Kong маршрутизирует `/functions/v1/<name>` на наш `api`-контейнер — фронт продолжает звать `supabase.functions.invoke('ask-inga')` без правок.

### 7. Документация

`docs/SELF_HOSTING.md` — пошагово:
1. `cp .env.example .env`
2. `./scripts/generate-keys.sh >> .env`
3. (опц.) `./scripts/migrate-from-cloud.sh` для переноса данных
4. `docker compose up -d`
5. Настройка Nginx/Caddy для `legche.online` и `api.legche.online`
6. Получение SSL через Let's Encrypt
7. (опц.) Создание первого admin через `studio` или SQL

## Что НЕ меняется

- Структура БД, RLS-политики, триггеры, ENUMы
- Весь код фронта (`src/**`)
- Бизнес-логика edge-функций (только перенесено в Node-сервер)
- Пользовательский опыт: email+password, Google, Apple, recovery — всё работает как сейчас

## Что **удаляется**

- Зависимость от Supabase Cloud
- Все `SUPABASE_*` секреты, привязанные к облачному проекту
- Файл `supabase/config.toml` для self-hosted-режима не нужен (но оставлю, чтобы вы могли при желании пользоваться `supabase` CLI локально)

## Файлы, которые будут созданы/изменены

**Новые:**
- `docker/kong/kong.yml` — конфиг маршрутизации
- `scripts/generate-keys.sh` — генератор JWT
- `scripts/migrate-from-cloud.sh` — разовый перенос данных
- `server/migrations/000_init.sql` — собранная схема

**Изменённые:**
- `docker-compose.yml` — добавлены 5–6 сервисов
- `.env.example` — новые переменные
- `docs/SELF_HOSTING.md` — полная инструкция
- `Dockerfile` — без изменений (фронт), `server/Dockerfile` — без изменений

**Без изменений:**
- весь `src/**`
- `supabase/functions/**` (остаются для совместимости с `supabase` CLI, но в проде не используются)

## Порядок работ

1. Написать `docker-compose.yml`, `kong.yml`, `.env.example`
2. Скопировать ваши миграции в `server/migrations/000_init.sql`
3. Написать `scripts/generate-keys.sh` и `scripts/migrate-from-cloud.sh`
4. Переписать `docs/SELF_HOSTING.md`
5. Проверить, что `src/integrations/supabase/client.ts` корректно читает env (он и так корректен)

Жду подтверждение плана — после approve начну реализацию.
