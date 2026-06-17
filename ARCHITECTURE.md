# Архитектура приложения «Личный диетолог Инга»

> Документ описывает текущее техническое устройство приложения: фронтенд, бэкенд, базу данных, авторизацию, AI-интеграции и поток данных.

---

## 1. Технологический стек

| Слой           | Технологии                                                         |
| -------------- | ------------------------------------------------------------------ |
| Frontend       | React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui         |
| State          | React Context (`AppContext`) + локальный `useState` + `localStorage` |
| Backend (API)  | Node.js + Express (`server/`), модульные роутеры                   |
| База данных    | PostgreSQL через Lovable Cloud (Supabase) с RLS                    |
| Auth           | Supabase Auth: email/password, Google, Apple                       |
| AI             | Lovable AI Gateway (DeepSeek и др. модели) для чата и анализа еды  |
| Хостинг        | Lovable (preview + published)                                      |

---

## 2. Структура репозитория

```text
├── src/
│   ├── pages/                  # Корневые маршруты React Router
│   │   ├── Index.tsx           # Точка входа, оркестратор шагов (AppFlow)
│   │   ├── Admin.tsx
│   │   ├── ResetPassword.tsx
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── inga/               # Все экраны продукта (Auth, Survey*, Daily, Chat, Menu, …)
│   │   └── ui/                 # shadcn-компоненты
│   ├── context/AppContext.tsx  # Глобальный state, шаг flow, hydrateFromDb()
│   ├── lib/                    # Бизнес-логика и обёртки
│   │   ├── auth.ts             # Обёртка над Supabase auth
│   │   ├── db.ts               # Запросы к API/Supabase (saveFoodLog и т.д.)
│   │   ├── api-client.ts       # fetch-клиент к Express API
│   │   ├── ai-provider.ts      # Вызовы Lovable AI Gateway
│   │   ├── calculations.ts     # BMR/TDEE/дефицит
│   │   ├── daily-analysis.ts   # Аналитика дня (пилюли, рекомендации)
│   │   ├── morning-analysis.ts
│   │   ├── nutrition/          # Расчёты КБЖУ
│   │   └── types*.ts
│   └── integrations/supabase/  # Авто-генерированный клиент + types (не редактировать)
│
├── server/                     # Express API (Lovable Cloud sidecar)
│   ├── routes/
│   │   ├── index.js            # Монтирует все роуты под /api/v1
│   │   ├── profile.js          # Профиль пользователя
│   │   ├── plan.js             # План питания / цели
│   │   ├── behavior.js         # Поведенческий профиль
│   │   ├── assessment.js       # Ответы опроса
│   │   ├── checkins.js         # Утро/вечер чек-ины
│   │   ├── meal-plans.js
│   │   ├── food-logs.js        # CRUD приёмов пищи
│   │   ├── chat-events.js
│   │   ├── reflections.js
│   │   ├── events.js           # Аналитика событий
│   │   ├── consultations.js
│   │   ├── nutrition.js        # КБЖУ + food_reference
│   │   └── admin.js
│   └── migrations/             # SQL для пользовательских таблиц
│
├── supabase/
│   ├── migrations/             # Облачные миграции БД
│   └── config.toml             # (auto)
│
├── docs/user-flow.md           # User Flow
├── USER_FLOW.md                # Копия в корне (для Lovable UI)
└── ARCHITECTURE.md             # Этот документ
```

---

## 3. Архитектурная схема

```text
                   ┌──────────────────────────────────────────┐
                   │              Браузер пользователя         │
                   │  React (Vite) + Tailwind + shadcn/ui      │
                   │                                          │
                   │  AppContext  ─►  Screens (inga/*)        │
                   │       │              │                   │
                   │       ▼              ▼                   │
                   │  localStorage   useState (UI)            │
                   └─────┬───────────────┬────────────────────┘
                         │               │
              Supabase JS │               │ fetch (api-client)
                         ▼               ▼
        ┌────────────────────────┐   ┌────────────────────────┐
        │   Lovable Cloud        │   │  Express API (server/) │
        │   (Supabase)           │   │  /api/v1/*             │
        │                        │   │                        │
        │ - Auth (email/Google/  │   │ profile / plan /       │
        │   Apple)               │   │ checkins / food-logs / │
        │ - PostgreSQL + RLS     │   │ chat-events / events / │
        │ - Storage              │◄──┤ nutrition / admin …    │
        └─────────┬──────────────┘   └─────────┬──────────────┘
                  │                            │
                  ▼                            ▼
        ┌────────────────────────────────────────────┐
        │            PostgreSQL (public.*)           │
        │  users, user_profile, user_plan,           │
        │  behavior_profile, assessment_answers,     │
        │  daily_checkins, food_logs, food_analysis, │
        │  evening_reflections, meal_plans,          │
        │  chat_events, user_events, consultations,  │
        │  subscriptions, content_library,           │
        │  daily_nutrition_summary, food_reference,  │
        │  nutrients_reference, user_roles,          │
        │  app_settings, app_credentials,            │
        │  password_reset_tokens, oauth_accounts     │
        └────────────────────────────────────────────┘

                         ▲
                         │ AI-запросы
                         │
        ┌────────────────┴────────────────┐
        │     Lovable AI Gateway          │
        │  DeepSeek / др. модели          │
        │  - Чат с Ингой                  │
        │  - Анализ блюда (белок/калории) │
        │  - Утренний/дневной разбор      │
        └─────────────────────────────────┘
```

---

## 4. Слои приложения

### 4.1 Frontend

**Точка входа:** `src/pages/Index.tsx` → `<AppProvider>` → `<AppFlow>`.

`AppFlow` слушает `auth.onAuthStateChange`, после успешного входа вызывает `hydrateFromDb()` (подтягивает профиль и определяет текущий `step`), затем рендерит экран по `switch(step)`:

```
auth → survey-name → goal → why → survey-data → tracking-method
     → how-it-works → route-ready → daily ⇄ menu ⇄ chat
```

**Глобальный state — `AppContext`:**
- `step` — текущий экран flow.
- `user` — профиль + измерения + цели.
- `hydrateFromDb()` — загрузка всего состояния из БД при логине.
- Хелперы для обновления профиля, целей, прогресса.

**Локальное состояние / persistence:**
- `useState` — UI каждого экрана.
- `localStorage`:
  - `dailyActiveTab` + `dailyActiveTabDate` — активная вкладка (morning/food/evening) с авто-сбросом на новые сутки.
  - Кэш auth-сессии — управляется Supabase JS.

### 4.2 Backend (Express)

`server/routes/index.js` монтирует все роуты под префиксом `/api/v1`:

| Префикс            | Назначение                                            |
| ------------------ | ----------------------------------------------------- |
| `/profile`         | Чтение/обновление профиля пользователя                |
| `/plan`            | План питания, цель, дефицит                           |
| `/behavior`        | Поведенческий профиль (адаптация тона ИИ)             |
| `/assessment`      | Ответы анкеты онбординга                              |
| `/checkins`        | Утренние/вечерние чек-ины                             |
| `/meal-plans`      | Меню на день/неделю                                   |
| `/food-logs`       | CRUD приёмов пищи (POST/PATCH/DELETE)                 |
| `/chat-events`     | События чата с Ингой                                  |
| `/reflections`     | Вечерние рефлексии                                    |
| `/events`          | Продуктовая аналитика                                 |
| `/consultations`   | Записи на консультации                                |
| `/nutrition`       | Расчёт КБЖУ + `food-reference`                        |
| `/admin`           | Админ-эндпоинты (только роль `admin`)                 |

Каждый роут использует `_helpers.js` для авторизации (валидация Supabase JWT), затем работает с БД через service-role клиент.

### 4.3 База данных (PostgreSQL)

Ключевые таблицы в `public`:

| Таблица                    | Назначение                                          |
| -------------------------- | --------------------------------------------------- |
| `users`                    | Зеркало `auth.users` + расширенные поля             |
| `user_profile`             | Пол, возраст, рост, вес, активность                 |
| `user_plan`                | Цель, дефицит, целевой вес, темп                    |
| `behavior_profile`         | Food-profile, эмоции, привычки                      |
| `assessment_answers`       | Сырые ответы анкеты                                 |
| `daily_checkins`           | Утро/вечер: сон, настроение, вес                    |
| `food_logs`                | Приёмы пищи (описание, время, тип, пилюли)          |
| `food_analysis`            | Результаты AI-анализа блюда                         |
| `daily_nutrition_summary`  | Агрегаты КБЖУ по дням                               |
| `evening_reflections`      | Вечерняя рефлексия                                  |
| `meal_plans`               | Планы питания                                       |
| `chat_events`              | Сообщения чата с Ингой                              |
| `user_events`              | Продуктовая аналитика                               |
| `consultations`            | Запросы на консультацию                             |
| `subscriptions`            | Подписки/тарифы                                     |
| `content_library`          | Образовательный контент                             |
| `food_reference`           | Справочник продуктов                                |
| `nutrients_reference`      | Справочник нутриентов                               |
| `user_roles`               | Роли (`admin`, `user`) — отдельная таблица для RLS  |
| `app_settings`             | Глобальные настройки приложения                     |
| `app_credentials`          | Секреты интеграций                                  |
| `password_reset_tokens`    | Email-сброс пароля                                  |
| `oauth_accounts`           | Привязки Google/Apple                               |

**Безопасность:** на всех `public.*` таблицах включён RLS; политики основаны на `auth.uid()` и `public.has_role(uid, 'admin')`. Роли хранятся **только** в `user_roles` (защита от privilege escalation).

### 4.4 Авторизация

- Провайдеры: **email/password**, **Google**, **Apple**.
- Анкета доступна только после входа (`isAuthed` гейт в `AppFlow`).
- Сессия хранится Supabase JS в `localStorage`; восстанавливается через `auth.getSession()`.
- Сброс пароля — отдельный маршрут `/reset-password` + таблица `password_reset_tokens`.

### 4.5 AI-интеграции

`src/lib/ai-provider.ts` — единая обёртка над **Lovable AI Gateway** (без своих ключей). Использование:

1. **Чат с Ингой** (`ChatScreen.tsx`) — эмпатичный диалог, тон адаптируется к `behavior_profile`.
2. **Анализ блюда** (`DailyScreen.tsx` → `saveFoodLog`) — DeepSeek оценивает белок/калории, результат → `food_analysis`.
3. **Утренний разбор** (`morning-analysis.ts`) — рекомендации на день по чек-ину.
4. **Дневная аналитика** (`daily-analysis.ts`) — пилюли «Белок / Углеводы / Клетчатка», советы.

Все AI-вызовы fire-and-forget с фолбэком на нейтральный ответ при ошибке.

---

## 5. Поток данных: пример «добавление приёма пищи»

```text
User → DailyScreen (food tab)
   │  ввод описания + тип приёма
   ▼
saveFoodLog(db.ts)
   │  POST /api/v1/food-logs              (Express)
   │  └─► INSERT INTO public.food_logs    (PostgreSQL)
   │  └─► AI-анализ (Lovable AI Gateway) → UPDATE food_analysis
   ▼
React state обновляется оптимистично
   │
   ▼ при изменении пилюль / удалении карточки
PATCH/DELETE /api/v1/food-logs/:id  → UPDATE/DELETE в БД
   │
   ▼
daily-analysis.ts пересчитывает рекомендации Инги
```

---

## 6. Сквозные правила

- **Ширина контента 480px** — единая для DailyScreen/Menu/Chat.
- **Все мутации fire-and-forget** — UI не блокируется ожиданием БД.
- **Никаких ролей в `user_profile`** — только `user_roles` + `has_role()`.
- **Auto-confirm email выключен**, антропологические сообщения и тон — через `behavior_profile`.
- **Авто-сброс активной вкладки на новые сутки** через сравнение `dailyActiveTabDate` с `today`.
- **Лимиты по здоровью:** не более 6 кг/мес, целевой BMI 18.5–24.9 (`calculations.ts`).
- **Запрещено редактировать:** `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `supabase/config.toml`.

---

## 7. Деплой

| Окружение  | URL                                                                |
| ---------- | ------------------------------------------------------------------ |
| Preview    | https://id-preview--7fd6bf82-6434-44a0-83d4-862a51b8ae57.lovable.app |
| Production | https://inga-your-guide.lovable.app                                 |

Деплой — через Lovable Publish. Миграции БД применяются автоматически при добавлении файлов в `supabase/migrations/`.
