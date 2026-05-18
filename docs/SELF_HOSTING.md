# Self-hosting «Личный диетолог Инга» (полностью на своём сервере)

С этой ревизией приложение работает **без edge-функций Lovable**. Всё крутится
в двух Docker-контейнерах на вашем сервере:

- `web` — статический фронт (React + Vite, отдаётся nginx).
- `api` — Node/Express, заменяет edge-функции `ask-inga`, `estimate-nutrition`,
  `start-trial`. Берёт ключи DeepSeek и строку подключения к Postgres из `.env`.

База данных — любой Postgres (свой Supabase, self-hosted Supabase, чистый PG).

---

## 1. Архитектура

```
[Браузер] ── HTTPS ──▶ [nginx (web)]                       (статика SPA)
   │
   └── HTTPS ──▶ [Node API (api:8787)] ──▶ DeepSeek API
                              │
                              └────────▶ Postgres (DATABASE_URL)

       Auth (login/session) ──▶ Supabase Auth (URL + anon key)
       CRUD таблиц            ──▶ Supabase REST (тот же URL, RLS)
```

Фронт продолжает использовать `@supabase/supabase-js` для auth и обычных
запросов к таблицам (RLS на стороне Postgres). А все «умные» вызовы
(LLM, триал) теперь идут на собственный `api`-контейнер.

Переключение делается одной build-time переменной — **`VITE_API_BASE_URL`**.
Если она задана, фронт зовёт `${VITE_API_BASE_URL}/ask-inga` и т.д.
Если пусто — старый путь через `supabase.functions.invoke`.

---

## 2. Переменные окружения

См. `.env.example`. Группы:

### Фронт (build-time, попадает в JS-бандл, должны быть ПУБЛИЧНЫМИ)

| Переменная                    | Назначение                                        |
|-------------------------------|---------------------------------------------------|
| `VITE_SUPABASE_URL`           | URL Supabase для auth и REST                      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (публичный)                            |
| `VITE_SUPABASE_PROJECT_ID`    | Project ref                                       |
| `VITE_API_BASE_URL`           | URL вашего `api`-контейнера, напр. `https://api.legche.online` |

### API-сервер (server-side, секреты НЕ попадают в браузер)

| Переменная                | Назначение                                            |
|---------------------------|-------------------------------------------------------|
| `DATABASE_URL`            | Postgres: `postgresql://user:pass@host:5432/db?sslmode=require` |
| `SUPABASE_URL`            | Тот же, что у фронта — для валидации JWT              |
| `SUPABASE_ANON_KEY`       | Тот же anon key — для `auth.getUser(token)`           |
| `DEEPSEEK_API_KEY`        | Ключ DeepSeek                                          |
| `DEEPSEEK_BASE_URL`       | По умолчанию `https://api.deepseek.com`                |
| `DEEPSEEK_MODEL`          | По умолчанию `deepseek-chat`                           |
| `CORS_ORIGIN`             | Разрешённые домены фронта, через запятую или `*`      |

---

## 3. Запуск

```bash
git clone <ваш-репозиторий>
cd <repo>

cp .env.example .env
# Заполните DATABASE_URL, DEEPSEEK_*, VITE_*, VITE_API_BASE_URL, CORS_ORIGIN

docker compose build
docker compose up -d
```

После старта:
- фронт на `http://<server-ip>/`
- API на `http://<server-ip>:8787/healthz` → `{"ok":true}`

Для prod закройте 8787 файрволом и поставьте reverse-proxy (Caddy):

```caddyfile
legche.online, www.legche.online {
    reverse_proxy localhost:80
}

api.legche.online {
    reverse_proxy localhost:8787
}
```

И в `.env` укажите `VITE_API_BASE_URL=https://api.legche.online`.

---

## 4. База данных

### 4.1 Перенос схемы

```bash
export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"
./scripts/apply-migrations.sh
```

Скрипт прогоняет все файлы из `supabase/migrations/` по порядку.

### 4.2 Перенос данных (если нужно)

```bash
pg_dump --data-only --schema=public --schema=auth \
    "postgresql://postgres:OLD_PASS@db.OLD-REF.supabase.co:5432/postgres" > data.sql
psql "$DATABASE_URL" < data.sql
```

### 4.3 Auth

Auth (email + Google + Apple) остаётся в Supabase. Если вы поднимаете
свой Supabase, включите провайдеры в новом проекте и добавьте redirect URL'ы
для своего домена.

---

## 5. API: контракты эндпоинтов

Все три эндпоинта требуют заголовок `Authorization: Bearer <supabase-jwt>`.

### POST `/ask-inga`
```json
Request:  { "message": "что съесть на ужин?",
            "routeType": "food_recommendation",   // опционально
            "userContext": {...}, "dayContext": {...} }
Response: { "answer": "...", "route": "food_recommendation", "provider": "deepseek" }
```

### POST `/estimate-nutrition`
```json
Request:  { "text": "200г куриной грудки и салат" }
Response: { "estimate": { "calories": 350, "protein_g": 45, ... }, "source": "ai_estimate" }
```

### POST `/start-trial`
```json
Request:  {}
Response: { "ok": true }
```

Ошибки: 401 (нет токена / истёк), 400 (валидация), 503 (LLM недоступен),
500 (внутренняя). Фронт умеет показывать понятные сообщения из поля
`userMessage`.

---

## 6. Откат и режимы

- **Полный self-host**: `.env` заполнен, `VITE_API_BASE_URL` указывает на свой API.
- **Гибрид**: используете свою БД, но AI оставляете в Lovable —
  оставьте `VITE_API_BASE_URL` пустым и не запускайте `api`-контейнер.
- **Полный Lovable**: всё пусто кроме `VITE_*` — работает старая схема edge-функций.

---

## 7. Безопасность

- `DEEPSEEK_API_KEY`, `DATABASE_URL`, `SUPABASE_*` — **только** в окружении
  `api`-контейнера, никогда в `VITE_*`.
- JWT валидируется на каждом запросе через `supabase.auth.getUser(token)`.
- RLS политик в БД достаточно, чтобы пользователь не дотянулся до чужих
  строк даже через прямой REST.
- `start-trial` использует pg-пул с правами роли БД, указанной в
  `DATABASE_URL`. Для production-надёжности дайте этой роли только нужные
  права (INSERT в `subscriptions`, SELECT по `users`).
