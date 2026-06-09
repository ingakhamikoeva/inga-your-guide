# План миграции с Supabase на Node API (Вариант A)

## 0. Аудит зависимостей от Supabase

`grep` по `supabase|@supabase|VITE_SUPABASE` нашёл следующие живые точки во фронте:

**Auth (supabase.auth.*)**
- `src/components/inga/AuthScreen.tsx` — signUp / signInWithPassword / resetPasswordForEmail
- `src/pages/ResetPassword.tsx` — onAuthStateChange / getSession / updateUser
- `src/pages/Index.tsx` — onAuthStateChange / getSession (страж сессии)
- `src/pages/Admin.tsx` — onAuthStateChange / getSession / signInWithPassword / signOut
- `src/integrations/lovable/index.ts` — обёртка OAuth (Google/Apple) поверх supabase.auth.setSession

**Data (supabase.from + RLS)**
- `src/lib/db.ts` — 17 таблиц-операций (полный CRUD приложения)
- `src/lib/app-settings.ts` — `app_settings`, `user_roles`
- `src/lib/nutrition/summary-store.ts` — `daily_nutrition_summary`, `users`
- `src/lib/nutrition/food-lookup.ts` — `food_reference`

**Functions / прочее**
- `src/lib/api-invoke.ts` — fallback на `supabase.functions.invoke` (после миграции не нужен)
- `src/integrations/supabase/client.ts` + `src/integrations/supabase/types.ts` — генерируемый клиент
- `supabase/*` (functions, migrations, config.toml), `docker/kong/kong.yml`, `scripts/{bootstrap-roles,apply-migrations,generate-keys,migrate-from-cloud}.sh`
- `Dockerfile`, `docker-compose.yml`, `.env*`, `docs/SELF_HOSTING.md`

## 1. Архитектура «после»

```text
Browser ──fetch + Bearer JWT──▶ Node API (Express)  ──pg.Pool──▶ PostgreSQL 15
                                  /api/v1/auth/*
                                  /api/v1/me, /profile, /plan, ...
                                  /api/v1/{ask-inga,estimate-nutrition,start-trial}
```

`docker-compose.yml` сводится к трём сервисам: `db`, `api`, `web`. Удаляются `kong`, `auth` (GoTrue), `rest` (PostgREST), `realtime`, `storage`, `studio`, `meta`, `imgproxy`, `vector`, `analytics`.

JWT — HS256, общий `JWT_SECRET` между api и фронтом не нужен (фронт хранит как opaque token + refresh). На сервере уже есть `requireAuth()`, расширим под собственную эмиссию токенов.

## 2. Эндпоинты API (`/api/v1/...`)

### Auth (новые)
| Метод | Путь                       | Назначение / что заменяет |
|-------|----------------------------|---------------------------|
| POST  | `/auth/signup`             | `supabase.auth.signUp` |
| POST  | `/auth/login`              | `supabase.auth.signInWithPassword` |
| POST  | `/auth/logout`             | `supabase.auth.signOut` |
| POST  | `/auth/refresh`            | автообновление сессии (заменяет `autoRefreshToken`) |
| GET   | `/auth/me`                 | `supabase.auth.getUser` / `getSession` |
| POST  | `/auth/password/forgot`    | `resetPasswordForEmail` (отправка письма) |
| POST  | `/auth/password/reset`     | `updateUser({ password })` (по recovery-токену) |
| GET   | `/auth/oauth/:provider`    | редирект на Google/Apple (по желанию; Фаза 6) |
| GET   | `/auth/oauth/:provider/callback` | приём кода → сессия |

Хранение: новая таблица `app_users` (email, password_hash, created_at, role) + `auth_sessions` (refresh tokens) + `password_resets`. `public.users.auth_id` начинает ссылаться на `app_users.id` вместо `auth.users.id`.

### Профиль / план / поведение (заменяют функции из `src/lib/db.ts`)
| Метод | Путь                        | Заменяет |
|-------|-----------------------------|----------|
| GET   | `/me`                       | `isAuthenticated`, имя из `users` |
| PATCH | `/me`                       | обновление `users.name` (часть `saveUserProfile`) |
| GET   | `/profile`                  | `loadUserProfile` |
| PUT   | `/profile`                  | `saveUserProfile` |
| GET   | `/plan`                     | `loadUserPlan` |
| PUT   | `/plan`                     | `saveUserPlan` |
| GET   | `/behavior-profile`         | `loadBehaviorProfile` |
| PUT   | `/behavior-profile`         | `saveBehaviorProfile` |
| GET   | `/assessment-answers`       | `loadAssessmentAnswers` |
| POST  | `/assessment-answers`       | `saveAssessmentAnswers` |

### Чек-ины / трекинг
| POST  | `/checkins`                 | `saveDailyCheckin` |
| GET   | `/checkins`                 | `loadCheckins` |
| POST  | `/meal-plans`               | `saveMealPlan` |
| GET   | `/meal-plans/:date`         | `loadMealPlanForDate` |
| POST  | `/food-logs`                | `saveFoodLog` |
| POST  | `/chat-events`              | `saveChatEvent` |
| POST  | `/reflections`              | `saveEveningReflection` |
| POST  | `/events`                   | `logUserEvent` |
| POST  | `/consultations`            | `requestConsultation` |
| POST  | `/start-trial`              | уже есть (`startTrial`) |

### Питание / сводки
| GET   | `/nutrition/summary/:date`  | `loadSummaryForDate` |
| PUT   | `/nutrition/summary/:date`  | `recomputeAndSaveSummary` (upsert) |
| GET   | `/food-reference?q=...`     | `tryFoodReference` |

### Админ / настройки
| GET   | `/settings/:key`            | `getSetting` |
| PUT   | `/settings/:key`            | `saveSetting` (требует роль admin) |
| GET   | `/me/roles`                 | `isCurrentUserAdmin` |

### AI (без изменений, только новый префикс)
| POST  | `/ask-inga`, `/estimate-nutrition`, `/start-trial` | существующие хендлеры |

Все data-эндпоинты берут `user_id` через `requireAuth()` → `req.auth.authId` → join к `public.users.auth_id`. Никогда из тела запроса.

## 3. Файлы, которые будут СОЗДАНЫ

**Сервер**
- `server/auth/index.js` — роутер `/auth/*`
- `server/auth/jwt.js` — sign/verify access (15m) + refresh (30d), bcrypt
- `server/auth/email.js` — отправка писем (SMTP через `nodemailer` — единственная новая зависимость; либо HTTP-провайдер, чтобы не плодить depы)
- `server/auth/oauth-google.js`, `server/auth/oauth-apple.js` (Фаза 6, опционально)
- `server/routes/me.js`, `profile.js`, `plan.js`, `behavior.js`, `assessments.js`, `checkins.js`, `meal-plans.js`, `food-logs.js`, `chat-events.js`, `reflections.js`, `events.js`, `consultations.js`, `nutrition.js`, `food-reference.js`, `settings.js`
- `server/db/users-repo.js` — резолв `authId → users.user_id`, общий хелпер
- `server/middleware/require-admin.js`
- `server/migrations/001_app_users.sql` — `app_users`, `auth_sessions`, `password_resets`; `public.users.auth_id` → FK на `app_users(id)`; индексы
- `server/migrations/002_drop_rls.sql` — `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` на всех public-таблицах (RLS уходит — авторизация на уровне API)

**Фронт**
- `src/lib/api-client.ts` — единый fetch-клиент: базовый URL, Bearer, авто-refresh, JSON-обработка ошибок
- `src/lib/auth/session.ts` — хранилище токенов (localStorage), эмиттер `onAuthStateChange` совместимой формы
- `src/lib/auth/auth.ts` — `signUp/signIn/signOut/getUser/getSession/resetPassword/updatePassword`
- `src/lib/auth/oauth.ts` — редиректы на `/auth/oauth/...` (Фаза 6)

**Docker / docs**
- `server/Dockerfile` — уже есть, без изменений
- `docs/SELF_HOSTING.md` — переписать под новый стек (правится, см. §4)

## 4. Файлы, которые будут ИЗМЕНЕНЫ

- `src/lib/db.ts` — все 17 функций переписать поверх `api-client.ts`. **Имена и сигнатуры export-функций сохраняются** (требование п.3 ТЗ).
- `src/lib/app-settings.ts` — на `/settings/:key` и `/me/roles`.
- `src/lib/nutrition/summary-store.ts` — на `/nutrition/summary/:date`.
- `src/lib/nutrition/food-lookup.ts` — `tryFoodReference` → `GET /food-reference`.
- `src/lib/api-invoke.ts` — упростить: всегда POST на `${API_BASE}/api/v1/${name}`, выкинуть ветку `supabase.functions.invoke`.
- `src/components/inga/AuthScreen.tsx` — заменить `supabase.auth.*` на `auth.ts` (UI не трогаем, только импорты и вызовы).
- `src/pages/ResetPassword.tsx` — на новый `updatePassword(token, newPassword)`.
- `src/pages/Index.tsx` — заменить `supabase.auth.getSession/onAuthStateChange` на эквивалент из `session.ts`.
- `src/pages/Admin.tsx` — то же + `signInWithPassword/signOut`.
- `src/integrations/lovable/index.ts` — переписать OAuth-обёртку на `oauth.ts` либо удалить, если не используется вне AuthScreen (проверить grep на этапе Фазы 5).
- `src/context/AppContext.tsx` — НЕ меняем публичный интерфейс (`hydrateFromDb`, `syncToDb`); внутри могут поменяться импорты, если он сам обращается к `supabase.auth`.
- `.env`, `.env.example` — добавить `VITE_API_BASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_*`, `OAUTH_*`. Убрать `VITE_SUPABASE_*` после Фазы 7.
- `Dockerfile` — убрать build-args `VITE_SUPABASE_*`.
- `docker-compose.yml` — оставить `db + api + web`, удалить остальное.
- `docs/SELF_HOSTING.md` — новая инструкция запуска.
- `server/index.js` — смонтировать новые роутеры под `/api/v1`.
- `server/package.json` — добавить `bcrypt`, `nodemailer` (минимально необходимое).
- `package.json` — удалить `@supabase/supabase-js` (после Фазы 7).

## 5. Файлы, которые будут УДАЛЕНЫ

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- весь каталог `supabase/` (functions, migrations, config.toml)
- `docker/kong/kong.yml` и каталог `docker/kong`
- `scripts/bootstrap-roles.sh`, `scripts/generate-keys.sh`, `scripts/apply-migrations.sh`, `scripts/migrate-from-cloud.sh` (заменяются одним `scripts/db-migrate.sh` — простой `psql -f` по `server/migrations/*.sql`)

## 6. Фазы и порядок работ

### Фаза 1 — Backend: auth + миграции БД
- `server/migrations/001_app_users.sql`, `002_drop_rls.sql`
- `server/auth/*`, `/api/v1/auth/*` в `server/index.js`
- bcrypt + JWT (access/refresh), эндпоинт `/auth/me`
- Письма: на этом этапе допускается лог в консоль вместо SMTP (флаг `MAIL_TRANSPORT=console`)
- **Тест:** curl signup → login → me → refresh → logout; проверить запись в `app_users` и связку `users.auth_id`.

### Фаза 2 — Backend: data-роуты
- Реализовать все эндпоинты из §2 (кроме AI — они уже есть)
- Везде `requireAuth` + резолв `users.user_id` через `users-repo.js`
- **Тест:** для каждой group endpoints curl-сценарий CRUD под валидным JWT; запрос без токена → 401; чужой `user_id` в URL/теле игнорируется.

### Фаза 3 — Frontend: api-client + auth-слой
- `api-client.ts`, `session.ts`, `auth.ts`
- Подменить `src/lib/api-invoke.ts` на прямой fetch
- **Тест:** `npm run build`; вручную в браузере — login через новый клиент работает, токены сохраняются, авто-refresh при 401.

### Фаза 4 — Frontend: переписать `db.ts`, `app-settings.ts`, `nutrition/*`
- Сохранить экспорты 1:1
- **Тест:** прогон ключевых пользовательских сценариев (опрос → план → дневной чек-ин → лог еды → сводка дня). UI не трогался → визуальной регрессии быть не должно. Запустить `bunx vitest run`.

### Фаза 5 — Frontend: страницы (AuthScreen / ResetPassword / Index / Admin / lovable wrapper)
- Только замена импортов и вызовов
- **Тест:** регистрация, вход, выход, восстановление пароля, админка под ролью `admin`.

### Фаза 6 — OAuth Google/Apple (опционально, может быть отложено)
- Серверные роуты `/auth/oauth/:provider[/callback]`
- Фронт: редирект из `AuthScreen` (UI без изменений)
- **Тест:** полный round-trip через тестовый Google-клиент.

### Фаза 7 — Очистка
- Удалить файлы из §5, выкинуть `@supabase/supabase-js`, очистить `.env*`, `Dockerfile`, `docker-compose.yml` (только `db + api + web`)
- Переписать `docs/SELF_HOSTING.md`
- **Тест:** чистый `docker compose up -d --build` на пустой машине → приложение работает; `rg supabase src/ server/` пусто.

## 7. Риски и зависимости

- **Существующие пользователи в `auth.users`.** При живой инсталляции нужен скрипт миграции `auth.users → app_users`. Пароли GoTrue хранит в bcrypt, формат совместим → перенос хеша без сброса. Если БД пуста (как сейчас на VM) — риск отсутствует, добавить заметку в `SELF_HOSTING.md`.
- **RLS уходит.** После Фазы 2 безопасность держится только на API. Любой пропущенный фильтр `user_id` = утечка. Митигация: единый middleware `withUser(req)` + ревью каждого роута + интеграционный тест «чужой user_id».
- **JWT-формат меняется.** Старые токены Supabase станут невалидны → все клиенты разлогинятся при деплое. Указать в release notes.
- **OAuth.** Без Google/Apple до Фазы 6 — кнопки в `AuthScreen` должны быть либо скрыты, либо показывать «временно недоступно». Решение принимается перед Фазой 5.
- **Email отправка.** Пока нет SMTP — recovery работать не будет. До Фазы 7 допустим лог-транспорт; для прод-инсталляции в `SELF_HOSTING.md` потребуется обязательный SMTP.
- **Совместимость `AppContext`.** Внутри он может вызывать `supabase.auth` — проверить в Фазе 3; публичная сигнатура `hydrateFromDb/syncToDb` сохраняется.
- **Порядок фаз строгий:** 1 → 2 → 3 → 4 → 5. Фронт нельзя ломать раньше, чем backend готов целиком. Фаза 6 и 7 — после стабилизации.

---

Жду подтверждения, чтобы стартовать Фазу 1.
