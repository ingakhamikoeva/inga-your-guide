# Self-hosting «Личный диетолог Инга»

Документ описывает: как развернуть фронтенд на своём сервере через Docker Compose,
как перенести базу данных, и какие у приложения есть бэкенд-зависимости (Supabase,
edge-функции, AI-провайдеры и т.д.).

---

## 1. Архитектура

```
┌───────────────────────────────┐         ┌─────────────────────────────────────┐
│  Браузер пользователя          │         │  Бэкенд (Supabase / Lovable Cloud)  │
│  ─────────────────────────     │         │  ─────────────────────────────────  │
│  React + Vite SPA              │  HTTPS  │  • PostgreSQL (схема public)        │
│  (контейнер nginx на вашем     │ ──────▶ │  • Auth (email + Google + Apple)    │
│   сервере)                     │         │  • Edge Functions (Deno):           │
│                                │         │      - ask-inga                     │
│                                │         │      - estimate-nutrition           │
│                                │         │      - start-trial                  │
│                                │         │  • Storage (не используется)        │
└───────────────────────────────┘         └─────────────────────────────────────┘
                                                        │
                                                        │  серверный вызов
                                                        ▼
                                          ┌─────────────────────────────┐
                                          │  AI-провайдеры              │
                                          │  • Lovable AI Gateway       │
                                          │    (LOVABLE_API_KEY)        │
                                          │  • DeepSeek (опционально,   │
                                          │    DEEPSEEK_API_KEY)        │
                                          └─────────────────────────────┘
```

Фронтенд **не общается с AI напрямую** — только через edge-функции бэкенда.
Это значит: вы можете захостить фронтенд где угодно, а бэкенд оставить в Lovable Cloud
(вариант А) или поднять свой Supabase (вариант Б).

---

## 2. Развёртывание фронтенда через docker-compose

### 2.1 Предусловия

- Сервер с Docker и docker-compose (Linux, 1 vCPU / 1 GB RAM достаточно).
- Доменное имя, направленное на сервер (например, `legche.online`).
- TLS-сертификат (рекомендуется внешний reverse-proxy: Caddy / Traefik / Cloudflare).

### 2.2 Файлы

В корне проекта лежат:

- `Dockerfile` — мульти-стейдж сборка (Node → nginx).
- `nginx.conf` — конфиг с SPA-fallback и кэшем статики.
- `docker-compose.yml` — один сервис `web`.
- `.env.example` — шаблон переменных окружения.
- `.dockerignore` — что не тащить в контекст.

### 2.3 Запуск

```bash
git clone <ваш-форк-репозитория>
cd <repo>

cp .env.example .env
# Откройте .env и заполните VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
# VITE_SUPABASE_PROJECT_ID. Это ПУБЛИЧНЫЕ значения, их не страшно вшивать в бандл.

docker compose build
docker compose up -d
```

После старта приложение доступно на `http://<server-ip>/`.

### 2.4 HTTPS / домен

Самый простой вариант — поставить перед контейнером Caddy:

```caddyfile
legche.online, www.legche.online {
    reverse_proxy localhost:80
}
```

Caddy сам получит и обновит Let's Encrypt сертификат.

### 2.5 Обновление

```bash
git pull
docker compose build --no-cache web
docker compose up -d
```

### 2.6 Важные нюансы

- **Build-time переменные.** `VITE_*` зашиваются в JS на этапе `npm run build`.
  Поменять URL Supabase «налету» нельзя — нужен ребилд образа.
- **OAuth redirect.** Если меняется домен фронта, в Supabase надо добавить
  новые URL в *Authentication → URL Configuration → Redirect URLs*
  (`https://ваш-домен/`, `https://ваш-домен/**`).
- **Кастомный домен в Lovable.** Если фронт переехал с `*.lovable.app` на
  свой сервер, отвяжите домен от Lovable (Settings → Domains → Disconnect),
  иначе DNS будет конфликтовать.

---

## 3. Перенос базы данных

### 3.1 Что лежит в БД

Схема `public`, 21 таблица. Полный список — раздел 5.

Ключевые таблицы:
- `users` (связь с `auth.users` через `auth_id`, имя, статус, таймзона)
- `user_profile` (пол/возраст/рост/вес/цели, стадия loss/fixation/maintenance)
- `user_plan` (целевая калорийность, метод трекинга)
- `behavior_profile` (поведенческий профиль из теста)
- `assessment_answers` (ответы food-test)
- `daily_checkins`, `evening_reflections`, `daily_nutrition_summary`
- `food_logs`, `food_analysis`, `meal_plans`
- `food_reference`, `nutrients_reference` (справочники)
- `chat_events`, `user_events` (телеметрия)
- `consultations`, `subscriptions`
- `app_settings`, `user_roles`, `content_library`

Все миграции хранятся как файлы в `supabase/migrations/*.sql` — это и есть
схема в виде кода.

### 3.2 Вариант А — оставить БД в Lovable Cloud

Ничего делать не нужно. Фронт в Docker будет ходить на тот же
`https://wclbucuccuizyltupedh.supabase.co`, что и сейчас.
Edge-функции (`ask-inga`, `estimate-nutrition`, `start-trial`) продолжают
работать у Lovable.

**Минус:** редактировать edge-функции можно только из Lovable.

### 3.3 Вариант Б — свой Supabase

1. Создайте новый проект на [supabase.com](https://supabase.com) (или поднимите
   self-hosted Supabase через их официальный docker-compose).

2. Примените миграции:
   ```bash
   export DATABASE_URL="postgresql://postgres:PASSWORD@db.NEW-REF.supabase.co:5432/postgres"
   ./scripts/apply-migrations.sh
   ```
   Скрипт прогонит по порядку все файлы из `supabase/migrations/`.

3. Перенесите данные (если нужно — есть существующие пользователи).
   Из старого проекта:
   ```bash
   pg_dump --data-only --schema=public --schema=auth \
       "postgresql://postgres:OLD_PASS@db.wclbucuccuizyltupedh.supabase.co:5432/postgres" \
       > data.sql
   psql "$DATABASE_URL" < data.sql
   ```
   В Supabase Dashboard есть готовый wizard «Migrate data» — он удобнее.

4. Деплой edge-функций:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref NEW-REF
   supabase functions deploy ask-inga
   supabase functions deploy estimate-nutrition
   supabase functions deploy start-trial
   ```

5. Установите секреты (см. раздел 4):
   ```bash
   supabase secrets set LOVABLE_API_KEY=...
   supabase secrets set DEEPSEEK_API_KEY=...     # если используете
   supabase secrets set DEEPSEEK_BASE_URL=...
   supabase secrets set DEEPSEEK_MODEL=...
   ```

6. Включите Auth-провайдеры (Email + Google + Apple) в новом проекте.

7. Обновите `.env` фронтенда на новый `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` и пересоберите Docker-образ.

### 3.4 Вариант В — чистый Postgres без Supabase

Возможно, но нетривиально: код опирается на `auth.users`, RLS-политики через
`auth.uid()` и Supabase Auth. Чтобы уйти от Supabase полностью, придётся:
- заменить аутентификацию (например, на Auth.js + свою таблицу `users`),
- переписать все RLS-политики (или отключить RLS и вынести проверки в API-слой),
- заменить `supabase.functions.invoke(...)` на свои HTTP-эндпоинты.

Это уже не «миграция», а форк. В большинстве случаев проще оставить Supabase.

---

## 4. Бэкенд: справка по сервисам

### 4.1 PostgreSQL (схема `public`)

- Доступ из фронта — только через `@supabase/supabase-js` с anon-ключом.
- Безопасность — Row Level Security: каждая таблица видит только строки
  своего пользователя через `auth.uid() → users.auth_id → users.user_id`.
- Функции БД:
  - `handle_new_user()` — триггер на `auth.users`, создаёт строку в `public.users`.
  - `has_role(_user_id, _role)` — проверка роли (используется для админских политик).
  - `update_updated_at_column()` — общий триггер на `updated_at`.

### 4.2 Auth

Используется Supabase Auth:
- Email + пароль (signup / signin / reset).
- Google OAuth (managed credentials Lovable Cloud).
- Apple OAuth.

В коде вход — через хелпер `src/integrations/lovable/index.ts`
(`lovable.auth.signInWithOAuth`) и стандартный `supabase.auth` для email.

### 4.3 Edge Functions (Deno, в `supabase/functions/`)

| Функция              | Назначение                                                        | Внешние секреты                              |
|----------------------|-------------------------------------------------------------------|----------------------------------------------|
| `ask-inga`           | Основной чат с Ингой: маршрутизация запроса (food/support/safety/...), сборка system-prompt, вызов LLM, возврат ответа. **Сейчас по умолчанию использует DeepSeek** (`DEEPSEEK_*`). `LOVABLE_API_KEY` есть в окружении и зарезервирован под будущий fallback на Lovable AI Gateway. | `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` (+ `LOVABLE_API_KEY` опц.) |
| `estimate-nutrition` | Оценивает КБЖУ блюда по текстовому описанию (для дневного саммари). | `LOVABLE_API_KEY`                            |
| `start-trial`        | Создаёт строку в `subscriptions`, выставляет `trial_ends_at`.     | —                                            |

Контракты (упрощённо):

```ts
// ask-inga
POST /functions/v1/ask-inga
body: {
  message: string,
  routeType?: 'food_recommendation'|'support'|'safety'|'food_analysis'
            |'fixation'|'maintenance'|'general',
  userContext?: { name, gender, age, height, weight, goalWeight,
                  stage, trackingMethod, triggers, pattern, calorieTarget },
  dayContext?:  { todayMeals, sleepHours, stepsYesterday, yesterdayConclusion }
}
→ { answer: string, route: RouteType }

// estimate-nutrition
POST /functions/v1/estimate-nutrition
body: { text: string }
→ { estimate: { calories, protein_g, fat_g, carbs_g, fiber_g,
                has_protein, has_veg, has_fast_carbs_only,
                liquid_calories, confidence } }

// start-trial
POST /functions/v1/start-trial   (Authorization: Bearer <user-jwt>)
→ { ok: true }
```

Фронт вызывает их через `supabase.functions.invoke('ask-inga', { body })`.

### 4.4 AI-провайдеры

Используются на стороне edge-функций, не напрямую из браузера.

- **Lovable AI Gateway** — основной. Один ключ `LOVABLE_API_KEY`,
  даёт доступ к моделям `google/gemini-*` и `openai/gpt-*` без отдельных
  аккаунтов у вендоров. URL: `https://ai.gateway.lovable.dev/v1`.
  При своём Supabase можно продолжать ходить туда — ключ лежит в
  workspace Lovable.
- **DeepSeek** (опционально) — fallback / альтернатива. Секреты:
  `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`.

Обработка ошибок: `429` — лимит, `402` — закончились кредиты —
эти статусы фронт показывает пользователю.

### 4.5 Storage / файлы

Не используется. Бакетов нет.

### 4.6 Realtime

Не используется.

### 4.7 Секреты бэкенда (текущие)

Уже сконфигурированы в Lovable Cloud:

| Секрет                       | Где используется                          |
|------------------------------|-------------------------------------------|
| `LOVABLE_API_KEY`            | edge-функции `ask-inga`, `estimate-nutrition` |
| `DEEPSEEK_API_KEY`           | edge-функция `ask-inga` (fallback)        |
| `DEEPSEEK_BASE_URL`          | edge-функция `ask-inga`                   |
| `DEEPSEEK_MODEL`             | edge-функция `ask-inga`                   |
| `SUPABASE_URL`               | системный (доступен в edge runtime)       |
| `SUPABASE_ANON_KEY`          | системный                                 |
| `SUPABASE_SERVICE_ROLE_KEY`  | системный, для server-side операций       |
| `SUPABASE_JWKS`              | системный                                 |

**Никогда не выносите `SERVICE_ROLE_KEY` или `LOVABLE_API_KEY` в `.env`
фронтенда** — они попадут в JS-бандл.

---

## 5. Полная схема таблиц (для справки)

| Таблица                    | Назначение                                                |
|----------------------------|-----------------------------------------------------------|
| `users`                    | Профиль уровня системы (auth_id, name, status, tz)        |
| `user_profile`             | Антропометрия, цели, стадия (loss/fixation/maintenance)   |
| `user_plan`                | Калорийность, коридор, метод трекинга                     |
| `user_roles`               | Роли (`admin` и т.д.) — отдельная таблица для безопасности|
| `behavior_profile`         | Паттерн питания, триггеры, стиль поддержки                |
| `assessment_answers`       | Сырые ответы food-test                                    |
| `daily_checkins`           | Утренний чек-ин: вес, сон, шаги                           |
| `evening_reflections`      | Вечерняя рефлексия: эмоция, голод, что было трудно        |
| `daily_nutrition_summary`  | Дневное саммари КБЖУ + статусы                            |
| `food_logs`                | «Что съел» (текст / фото / голос)                         |
| `food_analysis`            | Разбор отдельной еды (калории, белок, риски)              |
| `meal_plans`               | Персональный план питания на дату                         |
| `food_reference`           | Справочник продуктов (кеш USDA + ручные записи)           |
| `nutrients_reference`      | Справочник нутриентов                                     |
| `chat_events`              | Лог событий чата (для дневного аналитики)                 |
| `user_events`              | Произвольные пользовательские события (телеметрия)        |
| `consultations`            | Заявки на консультацию с диетологом                       |
| `subscriptions`            | Триал / подписка                                          |
| `app_settings`             | AI-промпты, лимиты, оверрайды уроков (правит админ)       |
| `content_library`          | Контент: рецепты, статьи, уроки                           |

RLS включён на всех таблицах. Все политики — в `supabase/migrations/`.

---

## 6. Чек-лист «всё работает»

После переноса проверьте:

- [ ] Фронт открывается на своём домене по HTTPS.
- [ ] Login через email и через Google проходит, после редиректа сессия живая.
- [ ] Новый пользователь проходит онбординг и попадает в основной интерфейс.
- [ ] Существующий пользователь после логина сразу попадает в `daily`
      (не начинает онбординг заново — см. `hydrateFromDb` в `AppContext`).
- [ ] Чат с Ингой отвечает (значит, edge-функция `ask-inga` доступна и
      `LOVABLE_API_KEY` валиден).
- [ ] Утренний чек-ин и вес сохраняются (запись в `daily_checkins`).
- [ ] В Network нет 401/403 от Supabase — значит RLS настроен корректно.
